import { formatPoint } from '../utils/format'
import type { GameResult } from '../types'

interface Props {
  result: GameResult
}

export function ResultCard({ result }: Props) {
  return (
    <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#1c1033] to-[#0b0620] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.5)]">
      <p className="text-center text-xs font-bold tracking-widest text-fuchsia-300">
        ドパガキ我慢ゲーム
      </p>

      <p className="mt-4 text-center text-5xl font-black tabular-nums text-white">
        {formatPoint(result.finalPoint)}
        <span className="ml-1 text-xl">pt</span>
      </p>

      <div className="mt-4 flex justify-center gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white">
          {result.rank.name}
        </span>
        <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-sm font-bold text-fuchsia-200">
          ドパガキ度 {result.dopagakiPercent}％
        </span>
      </div>

      <p className="mt-4 text-center text-sm font-bold text-white/80">「{result.comment}」</p>
      <p className="mt-1 text-center text-xs text-white/50">{result.greedComment}</p>

      <p className="mt-5 text-center text-[11px] font-bold text-white/40">
        あなたは何pt取れる？
      </p>
    </div>
  )
}
