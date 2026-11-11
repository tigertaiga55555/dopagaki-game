import { describeBattleDecidedBy } from '../../challenge/formatPerformance'
import { PerformanceComparisonTable } from '../../components/PerformanceComparisonTable'
import { resolveAvatarEmoji } from '../../config/profileConfig'
import type { BattleFinishResult, BattleOpponentProfile } from '../../battle/types'

interface Props {
  result: BattleFinishResult
  viewerIsPlayerA: boolean
  myProfile: BattleOpponentProfile
  opponent: BattleOpponentProfile
  onHome: () => void
}

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: 対戦結果画面。WIN/LOSE/DRAWを大きく表示し、
 * 既存のPerformanceComparisonTable（Challengeと共通）で5指標比較・勝敗を決めた項目の
 * 強調・通常獲得DOPA%の補足文を表示する。Challengeの既存動作には一切触れていない。
 */
export function BattleResultScreen({ result, viewerIsPlayerA, myProfile, opponent, onHome }: Props) {
  const myPerformance = viewerIsPlayerA ? result.playerA.performance : result.playerB.performance
  const opponentPerformance = viewerIsPlayerA ? result.playerB.performance : result.playerA.performance

  const outcome: 'win' | 'lose' | 'draw' =
    result.winner === 'draw' ? 'draw' : (result.winner === 'playerA') === viewerIsPlayerA ? 'win' : 'lose'

  const outcomeLabel = outcome === 'win' ? 'WIN' : outcome === 'lose' ? 'LOSE' : 'DRAW'
  const outcomeClass =
    outcome === 'win'
      ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.75)]'
      : outcome === 'lose'
        ? 'text-white/60'
        : 'text-sky-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.6)]'

  const finishNote =
    result.finishReason === 'forfeit'
      ? outcome === 'win'
        ? '相手の棄権により勝利'
        : '棄権'
      : result.finishReason === 'disconnect'
        ? outcome === 'win'
          ? '相手の切断により勝利'
          : '通信切断'
        : null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="text-xs font-black tracking-[0.3em] text-white/40">BATTLE RESULT</p>
      <p className={`anim-pop text-5xl font-black tracking-widest ${outcomeClass}`}>{outcomeLabel}</p>
      {finishNote && <p className="text-xs font-bold text-white/50">{finishNote}</p>}

      <div className="flex items-center gap-3">
        <span className="text-2xl">{resolveAvatarEmoji(myProfile.avatar)}</span>
        <span className="text-xs font-bold text-white/50">{myProfile.nickname}</span>
        <span className="text-xs font-black text-rose-400">VS</span>
        <span className="text-xs font-bold text-white/50">{opponent.nickname}</span>
        <span className="text-2xl">{resolveAvatarEmoji(opponent.avatar)}</span>
      </div>

      {result.decidedBy ? (
        <PerformanceComparisonTable
          leftLabel="YOU"
          left={myPerformance}
          rightLabel="RIVAL"
          right={opponentPerformance}
          decidedBy={result.decidedBy}
          reasonText={describeBattleDecidedBy(result.decidedBy, outcome)}
        />
      ) : (
        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/60">YOU</span>
            <span className="font-bold tabular-nums text-white">{myPerformance.finalDopaPercent}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60">RIVAL</span>
            <span className="font-bold tabular-nums text-white">{opponentPerformance.finalDopaPercent}%</span>
          </div>
        </div>
      )}

      <button
        onClick={onHome}
        className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white shadow-[0_6px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
      >
        ホームへ戻る
      </button>
    </div>
  )
}
