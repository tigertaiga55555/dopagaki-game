import { useEffect, useState } from 'react'
import { remoteChallengeDataSource } from '../challenge/remoteChallengeDataSource'
import { describeDecidedBy, formatAccuracyPercent, formatReactionSeconds } from '../challenge/formatPerformance'
import { trackChallengeWin } from '../utils/analytics'
import { getProfile } from '../utils/profileStorage'
import type { ChallengeApiError, ChallengeAttemptRecord, ChallengeDecidedBy, ChallengePerformance, ChallengeRecord } from '../challenge/types'
import type { FinalResultV4 } from '../types'

interface Props {
  challenge: ChallengeRecord
  myResult: FinalResultV4
  onRetry: () => void
  onHome: () => void
  onViewHistory: () => void
}

type SubmitState =
  | { status: 'submitting' }
  | { status: 'error'; error: ChallengeApiError }
  | { status: 'done'; attempt: ChallengeAttemptRecord }

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: Challenge挑戦の結果画面。
 * WIN/LOSEはクライアントでは一切判定せず、POST /api/challenges/:id/attemptsが
 * 返したサーバー確定のresultだけを表示する（クライアントが勝敗を自己申告できる
 * 余地を残さないユーザー指示を、画面側でも徹底する）。
 */
export function ChallengeResultScreen({ challenge, myResult, onRetry, onHome, onViewHistory }: Props) {
  const [state, setState] = useState<SubmitState>({ status: 'submitting' })

  useEffect(() => {
    let cancelled = false

    async function submit() {
      setState({ status: 'submitting' })
      // Ver.6 Phase 5.3（Challenge勝敗判定強化）: performanceが無ければ（通常は発生しない、
      // 新しい3エンジンのどの経路でも必ず計算されるが、念のための防御）推測値で埋めて
      // 送信せず、素直にエラー扱いにする。
      if (!myResult.challengePerformance) {
        setState({ status: 'error', error: 'internal_error' })
        return
      }
      const profile = getProfile()
      const res = await remoteChallengeDataSource.createAttempt(challenge.id, {
        challengeId: challenge.id,
        playerId: profile.playerId,
        nickname: profile.nickname,
        avatar: profile.avatar,
        equippedTitle: profile.equippedTitleId,
        score: myResult.percent,
        performance: myResult.challengePerformance,
      })
      if (cancelled) return
      if (res.ok) {
        setState({ status: 'done', attempt: res.value })
        if (res.value.result === 'win') trackChallengeWin(challenge.mode)
      } else {
        setState({ status: 'error', error: res.error })
      }
    }

    submit()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id])

  if (state.status === 'submitting') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-bold text-white/50">結果を送信中…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-sm font-bold text-white/70">結果の送信に失敗しました。通信環境をご確認のうえ、もう一度お試しください。</p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button onClick={onRetry} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white active:scale-95">
            もう一度挑戦する
          </button>
          <button onClick={onHome} className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95">
            ホームへ戻る
          </button>
        </div>
      </div>
    )
  }

  const { attempt } = state
  const isWin = attempt.result === 'win'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="text-xs font-black tracking-[0.3em] text-white/40">CHALLENGE RESULT</p>
      <p
        className={`anim-pop text-5xl font-black tracking-widest ${
          isWin ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.75)]' : 'text-white/60'
        }`}
      >
        {isWin ? 'WIN' : 'LOSE'}
      </p>

      {challenge.performance && attempt.performance && attempt.decidedBy ? (
        <PerformanceComparisonTable
          creatorNickname={challenge.creatorNickname}
          creator={challenge.performance}
          challenger={attempt.performance}
          decidedBy={attempt.decidedBy}
          result={attempt.result}
        />
      ) : (
        // Ver.6 Phase 5.3: このmigration以前に作成されたChallenge（performance無し）への挑戦は、
        // 詳細比較を表示できないため、従来どおりcreatorScoreだけの単純な比較を表示する。
        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/60">{challenge.creatorNickname}の記録</span>
            <span className="font-bold tabular-nums text-white">{challenge.creatorScore}％</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60">あなたの記録</span>
            <span className={`font-bold tabular-nums ${isWin ? 'text-amber-300' : 'text-white'}`}>{myResult.percent}％</span>
          </div>
        </div>
      )}

      <p className="text-xs font-bold text-white/40">挑戦{attempt.attemptNumber}回目</p>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onRetry}
          className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
        >
          もう一度挑戦する
        </button>
        <button onClick={onViewHistory} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white active:scale-95">
          挑戦の履歴を見る
        </button>
        <button onClick={onHome} className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95">
          ホームへ戻る
        </button>
      </div>
    </div>
  )
}

interface PerformanceComparisonTableProps {
  creatorNickname: string
  creator: ChallengePerformance
  challenger: ChallengePerformance
  decidedBy: ChallengeDecidedBy
  result: 'win' | 'lose'
}

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 作成者とあなたを横並びで比較する表。
 * 「同じ76%なのになぜLOSE？」が起きないよう、勝敗を決めた項目の行だけを強調し、
 * その下に必ず理由文（「通常獲得DOPA%でWIN」等）を表示する。
 */
function PerformanceComparisonTable({ creatorNickname, creator, challenger, decidedBy, result }: PerformanceComparisonTableProps) {
  const rows: { key: ChallengeDecidedBy; label: string; creatorValue: string; challengerValue: string }[] = [
    { key: 'finalDopaPercent', label: '最終DOPA%', creatorValue: `${creator.finalDopaPercent}%`, challengerValue: `${challenger.finalDopaPercent}%` },
    {
      key: 'baseDopaPercent',
      label: '通常獲得DOPA%',
      creatorValue: `${creator.baseDopaPercent}%`,
      challengerValue: `${challenger.baseDopaPercent}%`,
    },
    {
      key: 'accuracy',
      label: '正答率',
      creatorValue: formatAccuracyPercent(creator.accuracy),
      challengerValue: formatAccuracyPercent(challenger.accuracy),
    },
    { key: 'maxCombo', label: '最大COMBO', creatorValue: `${creator.maxCombo}`, challengerValue: `${challenger.maxCombo}` },
    {
      key: 'medianCorrectReactionMs',
      label: '反応速度中央値',
      creatorValue: formatReactionSeconds(creator.medianCorrectReactionMs),
      challengerValue: formatReactionSeconds(challenger.medianCorrectReactionMs),
    },
  ]

  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="overflow-hidden rounded-2xl bg-white/5">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 text-[10px] font-bold text-white/40">
          <span />
          <span className="text-right">{creatorNickname}</span>
          <span className="text-right">あなた</span>
        </div>
        {rows.map((row) => {
          const isDecisive = decidedBy === row.key
          return (
            <div
              key={row.key}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2 text-sm ${
                isDecisive ? 'border-y border-amber-300/50 bg-amber-400/10' : ''
              }`}
            >
              <span className={isDecisive ? 'font-bold text-amber-200' : 'text-white/60'}>{row.label}</span>
              <span className="text-right font-bold tabular-nums text-white">{row.creatorValue}</span>
              <span className={`text-right font-bold tabular-nums ${isDecisive ? 'text-amber-300' : 'text-white'}`}>
                {row.challengerValue}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-sm font-black text-amber-200">{describeDecidedBy(decidedBy, result)}</p>
    </div>
  )
}
