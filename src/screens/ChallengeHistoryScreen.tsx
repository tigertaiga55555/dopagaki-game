import { useEffect, useState } from 'react'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import {
  BASE_DOPA_PERCENT_NOTE,
  describeDecidedBy,
  formatAccuracyPercent,
  resultForViewer,
  type ChallengeViewerPerspective,
} from '../challenge/formatPerformance'
import { AchievementUnlockBanner } from '../components/AchievementUnlockBanner'
import { trackChallengeHistoryView } from '../utils/analytics'
import { checkEndlessChallengeDefenseAchievement } from '../utils/achievementStorage'
import { getOrCreatePlayerId } from '../utils/profileStorage'
import type { ChallengeApiError, ChallengeAttemptRecord, ChallengeMode, ChallengeRecord } from '../challenge/types'
import type { AchievementId } from '../types'

interface Props {
  challenge: ChallengeRecord
  onBack: () => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: ChallengeApiError }
  | { status: 'ready'; attempts: ChallengeAttemptRecord[]; truncated: boolean }

/** Ver.6 Phase 8: 通常Challengeの新しいDRAW仕様・ENDLESS Challengeの同STREAK数DRAWの両方で使う。 */
const RESULT_LABEL: Record<ChallengeAttemptRecord['result'], string> = { win: 'WIN', lose: 'LOSE', draw: 'DRAW' }

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: Challengeの挑戦履歴画面。
 *
 * 作成者本人が開いた場合：誰が挑戦したか・各挑戦者の最新結果・挑戦回数・
 * LOSE→LOSE→WIN等の履歴を、挑戦者ごとにグルーピングして表示する。
 * 挑戦者本人が開いた場合：自分自身のこのChallengeへの挑戦履歴だけを表示する。
 * どちらの立場かはgetOrCreatePlayerId()とchallenge.creatorPlayerIdの一致で判定する
 * （Challenge専用の別権限管理は持たない——ユーザー指示どおりProfile情報をそのまま使う）。
 *
 * 無料ユーザー（DOPA PASS未実装の現段階では全員）はサーバー既定の直近10件までしか
 * 見えない。DBには全件残っているため、将来DOPA PASSを実装する際はサーバー側のlimitを
 * 外すだけでよい（utils/… 側の変更は不要）。
 */
export function ChallengeHistoryScreen({ challenge, onBack }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementId[]>([])
  const viewerPlayerId = getOrCreatePlayerId()
  const isCreator = viewerPlayerId === challenge.creatorPlayerId
  // Ver.6 Phase 5.4（実機QA最終修正）: D1上のattempt.resultは常に挑戦者視点で保存されている。
  // 作成者（ホスト）がこの画面を開いた場合だけ、表示直前に反転する（DBの値は書き換えない）。
  const perspective: ChallengeViewerPerspective = isCreator ? 'host' : 'challenger'

  useEffect(() => {
    trackChallengeHistoryView(challenge.mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const options = isCreator ? undefined : { playerId: viewerPlayerId }
    remoteChallengeDataSource.getAttempts(challenge.id, options).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setState({ status: 'ready', attempts: res.value.attempts, truncated: res.value.truncated })
        // Ver.6 Phase 8（ENDLESS Challenge）: ホストが自分のENDLESS Challengeの履歴を開き、
        // 誰か1人でも防衛できている（挑戦者視点でlose/draw＝ホスト視点でwin）ことが
        // 確認できた時点で「終わらない門番」を解除する。
        if (isCreator && challenge.mode === 'endless') {
          const defended = res.value.attempts.some((a) => resultForViewer(a.result, 'host') === 'win')
          setNewlyUnlocked(checkEndlessChallengeDefenseAchievement(defended))
        }
      } else {
        setState({ status: 'error', error: res.error })
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id, isCreator])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-bold text-white/50">履歴を読み込み中…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-sm font-bold text-white/70">履歴の読み込みに失敗しました。</p>
        <button onClick={onBack} className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-bold text-white active:scale-95">
          戻る
        </button>
      </div>
    )
  }

  const { attempts, truncated } = state

  // 作成者視点：挑戦者（playerId）ごとにグルーピングし、各グループ内は古い→新しい順（LOSE→LOSE→WIN等が自然に読める順）。
  const groups = isCreator
    ? Object.values(
        attempts.reduce<Record<string, { nickname: string; avatar: ChallengeAttemptRecord['avatar']; rows: ChallengeAttemptRecord[] }>>(
          (acc, row) => {
            const key = row.playerId
            if (!acc[key]) acc[key] = { nickname: row.nickname, avatar: row.avatar, rows: [] }
            acc[key].rows.push(row)
            return acc
          },
          {},
        ),
      ).map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => a.createdAt - b.createdAt) }))
    : null

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <AchievementUnlockBanner newlyUnlocked={newlyUnlocked} />
      <div className="flex items-center justify-between px-5 pt-4">
        <button onClick={onBack} className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/70 active:scale-95">
          ← 戻る
        </button>
        <p className="text-sm font-black tracking-widest text-white/80">挑戦の履歴</p>
        <div className="w-14" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        {challenge.mode === 'endless' && (
          <div className="w-full max-w-sm rounded-2xl bg-white/5 px-4 py-3 text-center text-xs">
            <p className="text-[10px] font-black tracking-widest text-white/40">TARGET</p>
            <p className="text-lg font-black tabular-nums text-amber-300">{challenge.creatorScore}連続</p>
          </div>
        )}

        {challenge.performance && (
          <div className="w-full max-w-sm space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-xs">
            <p className="mb-1 text-[10px] font-black tracking-widest text-white/40">
              {isCreator ? 'あなたの基準記録' : 'ホストの基準記録'}
            </p>
            <div className="grid grid-cols-4 gap-1 text-center">
              <BaselineStat label="最終%" value={`${challenge.performance.finalDopaPercent}`} />
              <BaselineStat label="通常%" value={`${challenge.performance.baseDopaPercent}`} />
              <BaselineStat label="正答率" value={formatAccuracyPercent(challenge.performance.accuracy)} />
              <BaselineStat label="COMBO" value={`${challenge.performance.maxCombo}`} />
            </div>
            <p className="pt-0.5 text-center text-[9px] text-white/30">{BASE_DOPA_PERCENT_NOTE}</p>
          </div>
        )}

        {attempts.length === 0 && <p className="mt-10 text-sm font-bold text-white/40">まだ挑戦記録がありません</p>}

        {isCreator && groups && (
          <div className="flex w-full max-w-sm flex-col gap-3">
            {groups.map((group) => {
              const latest = group.rows[group.rows.length - 1]
              const latestForHost = resultForViewer(latest.result, perspective)
              return (
                <div key={latest.playerId} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{resolveAvatarEmoji(group.avatar)}</span>
                    <p className="flex-1 truncate text-sm font-black text-white">{group.nickname}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        latestForHost === 'win'
                          ? 'bg-amber-400/20 text-amber-300'
                          : latestForHost === 'draw'
                            ? 'bg-white/15 text-white/70'
                            : 'bg-white/10 text-white/50'
                      }`}
                    >
                      最新: {RESULT_LABEL[latestForHost]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/40">
                    挑戦{group.rows.length}回 ・{' '}
                    {group.rows.map((r) => RESULT_LABEL[resultForViewer(r.result, perspective)]).join(' → ')}
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-white/5 pt-2">
                    {group.rows.map((r, i) => (
                      <AttemptDetailRow key={r.id} attempt={r} index={i + 1} perspective={perspective} mode={challenge.mode} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!isCreator && (
          <div className="flex w-full max-w-sm flex-col gap-2">
            {attempts.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <AttemptDetailRow attempt={row} index={row.attemptNumber} perspective={perspective} mode={challenge.mode} />
              </div>
            ))}
          </div>
        )}

        {truncated && <p className="mt-2 text-[10px] font-bold text-white/30">直近5件のみ表示しています（DOPA PASSで全履歴表示予定）</p>}
      </div>
    </div>
  )
}

function BaselineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] font-bold text-white/40">{label}</span>
      <span className="font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 1回ぶんのattemptの詳細（WIN/LOSE/DRAW・4指標・
 * 勝敗理由）。作成者視点（グループ内の各行）・挑戦者本人視点（自分の履歴）の両方で
 * 同じコンポーネントを使う（item 14: 「挑戦者本人の履歴でも、同じ詳細を見られて構いません」）。
 * performance/decidedByが無い（このmigration以前のattempt、またはmode==='endless'）場合は、
 * score・resultだけの簡易表示にフォールバックする。
 *
 * Ver.6 Phase 5.4（実機QA最終修正）: attempt.result自体は常に挑戦者視点（DBの値を書き換えない）
 * ため、perspectiveに応じて表示直前にだけ反転する（resultForViewer/describeDecidedBy参照）。
 * Ver.6 Phase 8: 反応速度中央値は通常Challengeの勝敗判定から除外されたため、詳細行からも削除した
 * （Battle側のPerformanceComparisonTableは別コンポーネントのため影響しない）。
 * mode==='endless'の場合はscoreをDOPA%ではなくSTREAK数として表示する。
 */
function AttemptDetailRow({
  attempt,
  index,
  perspective,
  mode,
}: {
  attempt: ChallengeAttemptRecord
  index: number
  perspective: ChallengeViewerPerspective
  mode: ChallengeMode
}) {
  const viewerResult = resultForViewer(attempt.result, perspective)
  const resultClass = viewerResult === 'win' ? 'text-amber-300' : viewerResult === 'draw' ? 'text-white/70' : 'text-white/50'

  if (mode === 'endless' || !attempt.performance || !attempt.decidedBy) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">{index}回目</span>
        <span className="font-bold tabular-nums text-white">{mode === 'endless' ? `${attempt.score}連続` : `${attempt.score}％`}</span>
        <span className={`font-black ${resultClass}`}>{RESULT_LABEL[viewerResult]}</span>
      </div>
    )
  }

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <span className="text-white/50">{index}回目</span>
        <span className={`font-black ${resultClass}`}>{RESULT_LABEL[viewerResult]}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-white/40">
        最終{attempt.performance.finalDopaPercent}% ・ 通常{attempt.performance.baseDopaPercent}% ・{' '}
        {formatAccuracyPercent(attempt.performance.accuracy)} ・ COMBO{attempt.performance.maxCombo}
      </p>
      <p className="mt-0.5 text-[10px] font-bold text-amber-200/80">
        {describeDecidedBy(attempt.decidedBy, attempt.result, perspective)}
      </p>
    </div>
  )
}
