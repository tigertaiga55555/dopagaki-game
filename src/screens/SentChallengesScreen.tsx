import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { getCreatedChallengeIds } from '../challenge/createdChallengesStorage'
import { trackChallengeSentListView } from '../utils/analytics'
import type { ChallengeApiError, ChallengeRecord, ChallengeSummary } from '../challenge/types'

interface Props {
  onBack: () => void
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
}

/**
 * Ver.6 Phase 5.3（送った挑戦状一覧）: ホームの大規模再設計をせず、Profileのサブ導線から
 * 開く一覧画面。createdChallengeIds（localStorageのID一覧のみ）→POST
 * /api/challenges/summaries（一括取得）という順で、Challenge情報本体はローカルへ一切
 * 保存しない方針を徹底する。
 */
export function SentChallengesScreen({ onBack, onOpenHistory }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [openingId, setOpeningId] = useState<string | null>(null)

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

      <p className="relative z-10 mt-2 text-center text-sm font-black tracking-widest text-white/80">作成したChallenge</p>

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        {state.status === 'loading' && <p className="mt-10 text-sm font-bold text-white/50">読み込み中…</p>}

        {state.status === 'empty' && (
          <p className="mt-10 text-sm font-bold text-white/40">まだ作成したChallengeはありません</p>
        )}

        {state.status === 'error' && <p className="mt-10 text-sm font-bold text-white/60">一覧の読み込みに失敗しました。</p>}

        {state.status === 'ready' && (
          <div className="flex w-full max-w-sm flex-col gap-3">
            {state.summaries.map((summary) => (
              <button
                key={summary.id}
                onClick={() => handleOpen(summary.id)}
                disabled={openingId !== null}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left active:scale-95 disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white">{summary.creatorScore}％への挑戦状</p>
                  <span className="text-[10px] font-bold tracking-widest text-white/40">{MODE_LABEL[summary.mode]}</span>
                </div>
                <p className="mt-1 text-[11px] text-white/40">
                  挑戦者 {summary.challengerCount}人 ・ {summary.attemptCount}回挑戦 ・ 突破 {summary.clearedCount}人
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
