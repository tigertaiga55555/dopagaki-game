import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { getParticipatedChallengeIds } from '../challenge/participatedChallengesStorage'
import { trackChallengeParticipatedListView } from '../utils/analytics'
import { getOrCreatePlayerId } from '../utils/profileStorage'
import { ENDLESS_THEME } from '../config/endlessTheme'
import type { ChallengeApiError, ChallengeRecord, ParticipatedChallengeSummary } from '../challenge/types'

interface Props {
  onBack: () => void
  /** Ver.6 Phase 5.4: 一覧の1件を開くと、GET /api/challenges/:idで取得した完全なChallengeRecordを渡す（既存のChallengeHistoryScreenをそのまま再利用する）。 */
  onOpenHistory: (challenge: ChallengeRecord) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: ChallengeApiError }
  | { status: 'ready'; summaries: ParticipatedChallengeSummary[] }

const MODE_LABEL: Record<ParticipatedChallengeSummary['mode'], string> = {
  normal: '通常プレイ',
  finalTrial: 'FINAL DOPA TRIAL',
  challenge500: 'LIMIT BREAK',
  endless: 'ENDLESS',
}

/** Ver.6 Phase 8（ENDLESS Challenge）: 一覧では「ENDLESS EASY/HARD/DANGER」のように難易度まで表示する。 */
function describeMode(summary: ParticipatedChallengeSummary): string {
  if (summary.mode === 'endless' && summary.endlessDifficulty) {
    return `ENDLESS ${ENDLESS_THEME[summary.endlessDifficulty].mood}`
  }
  return MODE_LABEL[summary.mode]
}

/**
 * Ver.6 Phase 5.4（実機QA最終修正）: 「参加したChallenge」一覧画面。SentChallengesScreen
 * （自分が作成したChallenge）と対になる、自分が他人のChallengeへ挑戦した履歴の一覧。
 * participatedChallengeIds（localStorageのID一覧のみ）→POST /api/challenges/participated-summaries
 * （一括取得）という順で、Challenge情報本体はローカルへ一切保存しない方針を徹底する
 * （SentChallengesScreenと同じ方針）。
 *
 * 表示する「自分の最新結果」は挑戦者視点のまま（反転しない）——自分の結果を自分の視点で
 * 見るのは当然WIN/LOSEそのままで良い。ホスト視点への反転が必要になるのは、ホストが
 * 自分の送ったChallengeの履歴を見る場合だけ（ChallengeHistoryScreen参照）。
 */
export function ParticipatedChallengesScreen({ onBack, onOpenHistory }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    trackChallengeParticipatedListView()
    const ids = getParticipatedChallengeIds()
    if (ids.length === 0) {
      setState({ status: 'empty' })
      return
    }
    let cancelled = false
    const playerId = getOrCreatePlayerId()
    remoteChallengeDataSource.getParticipatedSummaries(ids, playerId).then((res) => {
      if (cancelled) return
      if (res.ok) {
        // サーバーから返った順に依存せず、常に新しい順で表示する。
        setState({ status: 'ready', summaries: [...res.value].sort((a, b) => b.createdAt - a.createdAt) })
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
      <BackButton onBack={onBack} label="ホーム" />

      <p className="relative z-10 mt-2 text-center text-sm font-black tracking-widest text-white/80">参加したChallenge</p>

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        {state.status === 'loading' && <p className="mt-10 text-sm font-bold text-white/50">読み込み中…</p>}

        {state.status === 'empty' && (
          <p className="mt-10 text-sm font-bold text-white/40">まだ参加したChallengeはありません</p>
        )}

        {state.status === 'error' && <p className="mt-10 text-sm font-bold text-white/60">一覧の読み込みに失敗しました。</p>}

        {state.status === 'ready' && (
          <div className="flex w-full max-w-sm flex-col gap-3">
            {state.summaries.map((summary) => {
              const title = summary.creatorEquippedTitle ? TITLE_DEFS_BY_ID[summary.creatorEquippedTitle] : null
              return (
                <button
                  key={summary.id}
                  onClick={() => handleOpen(summary.id)}
                  disabled={openingId !== null}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left active:scale-95 disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{resolveAvatarEmoji(summary.creatorIcon)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{summary.creatorNickname}への挑戦</p>
                      {title && <p className="truncate text-[10px] font-bold text-fuchsia-300/80">{title.name}</p>}
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-white/40">{describeMode(summary)}</span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 text-[11px] text-white/40">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        summary.myLatestResult === 'win'
                          ? 'bg-amber-400/20 text-amber-300'
                          : summary.myLatestResult === 'draw'
                            ? 'bg-white/15 text-white/70'
                            : 'bg-white/10 text-white/50'
                      }`}
                    >
                      最新: {summary.myLatestResult === 'win' ? 'WIN' : summary.myLatestResult === 'draw' ? 'DRAW' : 'LOSE'}
                    </span>
                    <span>{summary.myAttemptCount}回挑戦</span>
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
