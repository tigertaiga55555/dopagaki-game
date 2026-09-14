import type { FinalResultV4 } from '../types'

interface Props {
  result: FinalResultV4
}

export function ResultCard({ result }: Props) {
  const isOverdrive = result.percent > 100
  const percentColor = isOverdrive ? 'text-amber-300' : result.percent >= 100 ? 'text-amber-200' : 'text-white'

  return (
    <div
      className={`w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#1c1033] to-[#0b0620] p-5 ${
        isOverdrive
          ? 'shadow-[0_0_0_1px_rgba(250,204,21,0.4),0_0_60px_rgba(250,204,21,0.35)]'
          : 'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.5)]'
      }`}
    >
      <p className="text-center text-xs font-bold tracking-widest text-fuchsia-300">
        {isOverdrive ? 'DOPA OVERDRIVE' : 'ドパガキゲーム'}
      </p>

      <p className="mt-2 text-center text-xs font-bold text-white/40">ドパガキ度</p>
      <p
        className={`text-center text-7xl font-black tabular-nums leading-none drop-shadow-[0_0_30px_rgba(217,70,239,0.5)] ${percentColor}`}
      >
        {result.percent}
        <span className="text-3xl">％</span>
      </p>

      <p className="mt-3 text-center text-lg font-black text-fuchsia-300">{result.type.name}</p>

      <div className="mt-4 flex justify-center gap-4 text-center">
        <div>
          <p className="text-[10px] font-bold text-white/40">最大COMBO</p>
          <p className="text-sm font-bold text-white/80">{result.maxCombo}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-white/40">最速反応</p>
          <p className="text-sm font-bold text-white/80">
            {result.fastestReactionMs !== null ? `${(result.fastestReactionMs / 1000).toFixed(2)}秒` : '--'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-white/40">正答率</p>
          <p className="text-sm font-bold text-white/80">{Math.round(result.accuracy * 100)}％</p>
        </div>
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

      <p className="mt-5 text-center text-[11px] font-bold text-white/40">100％いける？</p>
    </div>
  )
}
