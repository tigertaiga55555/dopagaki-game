import type { FinalResult } from '../types'

interface Props {
  result: FinalResult
}

export function ResultCard({ result }: Props) {
  return (
    <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#1c1033] to-[#0b0620] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.5)]">
      <p className="text-center text-xs font-bold tracking-widest text-fuchsia-300">測定終了</p>

      <p className="mt-2 text-center text-xs font-bold text-white/40">ドパガキ度</p>
      <p className="text-center text-7xl font-black tabular-nums leading-none text-white drop-shadow-[0_0_30px_rgba(217,70,239,0.5)]">
        {result.dopagakiPercent}
        <span className="text-3xl">％</span>
      </p>

      <p className="mt-3 text-center text-lg font-black text-fuchsia-300">{result.type.name}</p>

      <div className="mt-4 flex items-center justify-center gap-2 text-white/40">
        <span className="text-[11px] font-bold">GAME SCORE</span>
        <span className="text-sm font-bold tabular-nums text-white/70">{result.gameScore.toLocaleString()}</span>
      </div>

      {result.crimeRecords.length > 0 && (
        <div className="mt-4 space-y-1 rounded-2xl bg-white/5 p-3 text-left">
          <p className="text-[11px] font-bold text-white/40">あなたの犯行記録</p>
          {result.crimeRecords.map((line) => (
            <p key={line} className="text-xs text-white/80">
              ・{line}
            </p>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-sm font-bold text-white/70">「{result.comment}」</p>

      <p className="mt-5 text-center text-[11px] font-bold text-white/40">あなたは何％？</p>
    </div>
  )
}
