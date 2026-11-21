import { useEffect, useState } from 'react'
import { NavBar } from '../components/NavBar'
import { ChallengeModeFilterTabs } from '../components/ChallengeModeFilterTabs'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { getCreatedChallengeIds } from '../challenge/createdChallengesStorage'
import { trackChallengeSentListView } from '../utils/analytics'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { AchievementUnlockBanner } from '../components/AchievementUnlockBanner'
import { checkChallengeDefenseAchievements, checkChallengeWantedAchievement } from '../utils/achievementStorage'
import { matchesChallengeModeFilter, type ChallengeModeFilter } from '../utils/challengeModeFilter'
import { applyHistoryDisplayLimit } from '../utils/historyDisplay'
import { qaLocalEntitlementRepository } from '../payment/entitlementRepository'
import type { ChallengeApiError, ChallengeRecord, ChallengeSummary } from '../challenge/types'
import type { AchievementId } from '../types'

interface Props {
  onBack: () => void
  onHome: () => void
  /** Ver.6 Phase 5.3: 一覧の1件を開くと、GET /api/challenges/:idで取得した完全なChallengeRecordを渡す（既存のChallengeHistoryScreenをそのまま再利用する）。 */
  onOpenHistory: (challenge: ChallengeRecord) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: ChallengeApiError }
  | { status: 'ready'; summaries: ChallengeSummary[] }

const MODE_LABEL: Record<ChallengeSummary['mode'], string> = {
  normal: '通常プレイ',
  finalTrial: 'FINAL DOPA TRIAL',
  challenge500: 'LIMIT BREAK',
  endless: 'ENDLESS',
}

/** Ver.6 Phase 8（ENDLESS Challenge）: 一覧では「ENDLESS EASY/HARD/DANGER」のように難易度まで表示する。 */
function describeMode(summary: ChallengeSummary): string {
  if (summary.mode === 'endless' && summary.endlessDifficulty) {
    return `ENDLESS ${ENDLESS_THEME[summary.endlessDifficulty].mood}`
  }
  return MODE_LABEL[summary.mode]
}

/**
 * Ver.6 Phase 5.3（送った挑戦状一覧）: ホームの大規模再設計をせず、Profileのサブ導線から
 * 開く一覧画面。createdChallengeIds（localStorageのID一覧のみ）→POST
 * /api/challenges/summaries（一括取得）という順で、Challenge情報本体はローカルへ一切
 * 保存しない方針を徹底する。
 */
export function SentChallengesScreen({ onBack, onHome, onOpenHistory }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementId[]>([])
  const [modeFilter, setModeFilter] = useState<ChallengeModeFilter>('all')

  useEffect(() => {
    trackChallengeSentListView()
    const ids = getCreatedChallengeIds()
    if (ids.length === 0) {
      setState({ status: 'empty' })
      return
    }
    let cancelled = false
    remoteChallengeDataSource.getSummaries(ids).then((res) => {
      if (cancelled) return
      if (res.ok) {
        // サーバーから返った順に依存せず、常に新しい順で表示する。
        setState({ status: 'ready', summaries: [...res.value].sort((a, b) => b.createdAt - a.createdAt) })
        // Ver.6 Phase 10（実績拡張ラウンド）: 防衛数ladder（初防衛/10防衛/25防衛、通常Challenge・
        // ENDLESS Challenge合算）はこの端末が作成した全ChallengeのdefeatedCountを合算して判定する。
        // 指名手配（1つのChallengeに10人以上の異なる挑戦者）は各ChallengeのchallengerCountの
        // 最大値で判定する（全Challengeのchallenger総数ではなく、1つで10人以上が条件）。
        const totalDefeated = res.value.reduce((sum, s) => sum + s.defeatedCount, 0)
        const maxChallengerCount = res.value.reduce((max, s) => Math.max(max, s.challengerCount), 0)
        setNewlyUnlocked([...checkChallengeDefenseAchievements(totalDefeated), ...checkChallengeWantedAchievement(maxChallengerCount)])
      } else {
        setState({ status: 'error', error: res.error })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleOpen(id: string) {
    if (openingId) return
    setOpeningId(id)
    const res = await remoteChallengeDataSource.getChallenge(id)
    setOpeningId(null)
    if (res.ok) onOpenHistory(res.value)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <NavBar onBack={onBack} onHome={onHome} />
      <AchievementUnlockBanner newlyUnlocked={newlyUnlocked} />

      <p className="relative z-10 mt-2 text-center text-sm font-black tracking-widest text-white/80">作成したChallenge</p>

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        {state.status === 'ready' && <ChallengeModeFilterTabs value={modeFilter} onChange={setModeFilter} />}

        {state.status === 'loading' && <p className="mt-10 text-sm font-bold text-white/50">読み込み中…</p>}

        {state.status === 'empty' && (
          <p className="mt-10 text-sm font-bold text-white/40">まだ作成したChallengeはありません</p>
        )}

        {state.status === 'error' && <p className="mt-10 text-sm font-bold text-white/60">一覧の読み込みに失敗しました。</p>}

        {state.status === 'ready' &&
          (() => {
            // 次フェーズ（DOPA PASS基盤ラウンド）: 無料ユーザーは直近5件のみ表示（表示層の
            // 制限のみ——ローカルID一覧・サーバー側のD1行は一切削除・切り詰めない）。
            // PASS購入後は即座に全件が見える。
            const hasFullHistory = qaLocalEntitlementRepository.hasEntitlement('FULL_HISTORY')
            const { visible, truncated } = applyHistoryDisplayLimit(state.summaries, hasFullHistory)
            const filtered = visible.filter((summary) => matchesChallengeModeFilter(summary.mode, modeFilter))
            return (
              <div className="flex w-full max-w-sm flex-col gap-3">
                {truncated && (
                  <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-center text-[11px] font-bold text-amber-300">
                    無料ユーザーは直近5件のみ表示されます。DOPA PASSで全履歴を表示できます。
                  </p>
                )}
                {filtered.length === 0 && (
                  <p className="mt-6 text-center text-sm font-bold text-white/40">このフィルターに該当するChallengeはありません</p>
                )}
                {filtered.map((summary) => (
                  <button
                    key={summary.id}
                    onClick={() => handleOpen(summary.id)}
                    disabled={openingId !== null}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left active:scale-95 disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-white">
                        {summary.mode === 'endless' ? `${summary.creatorScore}連続` : `${summary.creatorScore}％`}への挑戦状
                      </p>
                      <span className="text-[10px] font-bold tracking-widest text-white/40">{describeMode(summary)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">
                      挑戦者 {summary.challengerCount}人 ・ {summary.attemptCount}回挑戦 ・ 突破 {summary.clearedCount}人
                    </p>
                  </button>
                ))}
              </div>
            )
          })()}
      </div>
    </div>
  )
}
