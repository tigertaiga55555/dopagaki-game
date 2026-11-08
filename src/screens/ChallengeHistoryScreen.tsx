import { useEffect, useState } from 'react'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { describeDecidedBy, formatAccuracyPercent, formatReactionSeconds } from '../challenge/formatPerformance'
import { trackChallengeHistoryView } from '../utils/analytics'
import { getOrCreatePlayerId } from '../utils/profileStorage'
import type { ChallengeApiError, ChallengeAttemptRecord, ChallengeRecord } from '../challenge/types'

interface Props {
  challenge: ChallengeRecord
  onBack: () => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: ChallengeApiError }
  | { status: 'ready'; attempts: ChallengeAttemptRecord[]; truncated: boolean }

const RESULT_LABEL: Record<ChallengeAttemptRecord['result'], string> = { win: 'WIN', lose: 'LOSE' }

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
  const viewerPlayerId = getOrCreatePlayerId()
  const isCreator = viewerPlayerId === challenge.creatorPlayerId

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
      <div className="flex items-center justify-between px-5 pt-4">
        <button onClick={onBack} className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/70 active:scale-95">
          ← 戻る
        </button>
        <p className="text-sm font-black tracking-widest text-white/80">挑戦の履歴</p>
        <div className="w-14" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        {isCreator && challenge.performance && (
          <div className="w-full max-w-sm space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-xs">
            <p className="mb-1 text-[10px] font-black tracking-widest text-white/40">あなたの基準記録</p>
            <div className="grid grid-cols-5 gap-1 text-center">
              <BaselineStat label="最終%" value={`${challenge.performance.finalDopaPercent}`} />
              <BaselineStat label="通常%" value={`${challenge.performance.baseDopaPercent}`} />
              <BaselineStat label="正答率" value={formatAccuracyPercent(challenge.performance.accuracy)} />
              <BaselineStat label="COMBO" value={`${challenge.performance.maxCombo}`} />
              <BaselineStat label="反応" value={formatReactionSeconds(challenge.performance.medianCorrectReactionMs)} />
            </div>
          </div>
        )}

        {attempts.length === 0 && <p className="mt-10 text-sm font-bold text-white/40">まだ挑戦記録がありません</p>}

        {isCreator && groups && (
          <div className="flex w-full max-w-sm flex-col gap-3">
            {groups.map((group) => {
              const latest = group.rows[group.rows.length - 1]
              return (
                <div key={latest.playerId} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{resolveAvatarEmoji(group.avatar)}</span>
                    <p className="flex-1 truncate text-sm font-black text-white">{group.nickname}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        latest.result === 'win' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      最新: {RESULT_LABEL[latest.result]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/40">
                    挑戦{group.rows.length}回 ・{' '}
                    {group.rows.map((r) => RESULT_LABEL[r.result]).join(' → ')}
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-white/5 pt-2">
                    {group.rows.map((r, i) => (
                      <AttemptDetailRow key={r.id} attempt={r} index={i + 1} />
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
                <AttemptDetailRow attempt={row} index={row.attemptNumber} />
              </div>
            ))}
          </div>
        )}

        {truncated && <p className="mt-2 text-[10px] font-bold text-white/30">直近10件のみ表示しています（DOPA PASSで全履歴表示予定）</p>}
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
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 1回ぶんのattemptの詳細（WIN/LOSE・5指標・
 * 勝敗理由）。作成者視点（グループ内の各行）・挑戦者本人視点（自分の履歴）の両方で
 * 同じコンポーネントを使う（item 14: 「挑戦者本人の履歴でも、同じ詳細を見られて構いません」）。
 * performance/decidedByが無い（このmigration以前のattempt）場合は、score・resultだけの
 * 簡易表示にフォールバックする。
 */
function AttemptDetailRow({ attempt, index }: { attempt: ChallengeAttemptRecord; index: number }) {
  const resultClass = attempt.result === 'win' ? 'text-amber-300' : 'text-white/50'

  if (!attempt.performance || !attempt.decidedBy) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">{index}回目</span>
        <span className="font-bold tabular-nums text-white">{attempt.score}％</span>
        <span className={`font-black ${resultClass}`}>{RESULT_LABEL[attempt.result]}</span>
      </div>
    )
  }

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <span className="text-white/50">{index}回目</span>
        <span className={`font-black ${resultClass}`}>{RESULT_LABEL[attempt.result]}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-white/40">
        最終{attempt.performance.finalDopaPercent}% ・ 通常{attempt.performance.baseDopaPercent}% ・{' '}
        {formatAccuracyPercent(attempt.performance.accuracy)} ・ COMBO{attempt.performance.maxCombo} ・{' '}
        {formatReactionSeconds(attempt.performance.medianCorrectReactionMs)}
      </p>
      <p className="mt-0.5 text-[10px] font-bold text-amber-200/80">{describeDecidedBy(attempt.decidedBy, attempt.result)}</p>
    </div>
  )
}
