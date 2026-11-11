import { BASE_DOPA_PERCENT_NOTE, formatAccuracyPercent, formatReactionSeconds } from '../challenge/formatPerformance'
import type { ChallengeDecidedBy, ChallengePerformance } from '../challenge/types'

interface Props {
  leftLabel: string
  left: ChallengePerformance
  rightLabel: string
  right: ChallengePerformance
  /** 勝敗を決めた比較項目。exactTie（全項目同値）も含む。 */
  decidedBy: ChallengeDecidedBy
  /** 呼び出し側が組み立てた理由文（視点・WIN/LOSE/DRAWの意味づけは呼び出し側の責務）。 */
  reasonText: string
}

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: Challenge（ChallengeResultScreen）・Battle
 * （BattleResultScreen）の両方が使う、2者間のDOPA%比較表。「同じ76%なのになぜ
 * 負けた？」が起きないよう、勝敗を決めた行だけを強調し、その下に理由文を必ず表示する。
 * WIN/LOSE/DRAW・host/challenger等の意味づけは一切持たず、2つのChallengePerformanceを
 * 並べて見せるだけの中立なプレゼンテーション層にする（Challengeの既存動作を壊さず、
 * Battleでも同じ比較ロジック・同じUIを再利用できるようにするための共通化）。
 */
export function PerformanceComparisonTable({ leftLabel, left, rightLabel, right, decidedBy, reasonText }: Props) {
  const rows: { key: ChallengeDecidedBy; label: string; leftValue: string; rightValue: string }[] = [
    { key: 'finalDopaPercent', label: '最終DOPA%', leftValue: `${left.finalDopaPercent}%`, rightValue: `${right.finalDopaPercent}%` },
    { key: 'baseDopaPercent', label: '通常獲得DOPA%', leftValue: `${left.baseDopaPercent}%`, rightValue: `${right.baseDopaPercent}%` },
    { key: 'accuracy', label: '正答率', leftValue: formatAccuracyPercent(left.accuracy), rightValue: formatAccuracyPercent(right.accuracy) },
    { key: 'maxCombo', label: '最大COMBO', leftValue: `${left.maxCombo}`, rightValue: `${right.maxCombo}` },
    {
      key: 'medianCorrectReactionMs',
      label: '反応速度中央値',
      leftValue: formatReactionSeconds(left.medianCorrectReactionMs),
      rightValue: formatReactionSeconds(right.medianCorrectReactionMs),
    },
  ]

  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="overflow-hidden rounded-2xl bg-white/5">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 text-[10px] font-bold text-white/40">
          <span />
          <span className="text-right">{leftLabel}</span>
          <span className="text-right">{rightLabel}</span>
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
              <span className="text-right font-bold tabular-nums text-white">{row.leftValue}</span>
              <span className={`text-right font-bold tabular-nums ${isDecisive ? 'text-amber-300' : 'text-white'}`}>{row.rightValue}</span>
            </div>
          )
        })}
      </div>
      <p className="text-sm font-black text-amber-200">{reasonText}</p>
      <p className="text-center text-[9px] text-white/30">{BASE_DOPA_PERCENT_NOTE}</p>
    </div>
  )
}
