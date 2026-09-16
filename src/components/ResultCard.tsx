import type { FinalResultV4 } from '../types'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'

interface Props {
  result: FinalResultV4
}

/** ゴールド結果カードの装飾パーティクル位置（画面端寄り、控えめな数に限定） */
const GOLD_CARD_PARTICLES = [
  { x: 6, y: 12 },
  { x: 92, y: 20 },
  { x: 10, y: 78 },
  { x: 88, y: 70 },
  { x: 50, y: 6 },
]

/** Ver.4.11: 120%（PERFECT CLEAR）専用カードのsparkle装飾。金・白・虹を混ぜる。 */
const MAX_CARD_SPARKLES = [
  { x: 8, y: 8, color: '#facc15' },
  { x: 90, y: 10, color: '#ffffff' },
  { x: 5, y: 45, color: '#5cc8ff' },
  { x: 93, y: 48, color: '#ff5757' },
  { x: 10, y: 88, color: '#7dfcae' },
  { x: 88, y: 86, color: '#b98bff' },
  { x: 50, y: 4, color: '#ffffff' },
]

export function ResultCard({ result }: Props) {
  const isOverdrive = result.percent > 100
  // Ver.5.0: 「PERFECT CLEAR」「完全攻略」は200%（FINAL QUESTION正解）だけの専用表現。
  // 120%はもはやFINAL DOPA TRIALへの入口に過ぎないため、isMaxの基準をOVERDRIVE_CONFIG.maxPercent
  // （=120、useRushGame.ts側のOVERDRIVE上限capには今も使われる別概念の定数）から
  // FINAL_TRIAL_CONFIG.clearPercent（=200、真の完全攻略）へ切り替える。
  const isMax = result.percent >= FINAL_TRIAL_CONFIG.clearPercent
  // FINAL DOPA TRIALへ突入した（=result.finalTrialが存在する）が、200%まで到達できなかった場合。
  const isFinalTrial = !!result.finalTrial && !isMax
  const percentColor = isOverdrive ? 'text-amber-300' : result.percent >= 100 ? 'text-amber-200' : 'text-white'

  const card = (
    <div
      className={`relative isolate w-full overflow-hidden rounded-3xl bg-gradient-to-b p-5 ${
        isMax ? 'from-[#2e2408] to-[#120a02]' : isOverdrive ? 'from-[#241606] to-[#0b0620]' : 'from-[#1c1033] to-[#0b0620]'
      } ${
        isMax
          ? 'shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_0_110px_rgba(250,204,21,0.75)]'
          : isOverdrive
            ? 'shadow-[0_0_0_1px_rgba(250,204,21,0.4),0_0_60px_rgba(250,204,21,0.35)]'
            : 'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.5)]'
      }`}
    >
      {isOverdrive && !isMax && (
        <div className="pointer-events-none absolute inset-0 -z-10">
          {GOLD_CARD_PARTICLES.map((p, i) => (
            <span key={i} className="absolute text-sm text-amber-300/80" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              ✦
            </span>
          ))}
        </div>
      )}

      {isMax && (
        <>
          {/* 白ハイライト：カード上部から柔らかく白く発光させ、金一色にならないようにする */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-32 w-56 -translate-x-1/2 rounded-full bg-white/25 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 -z-10">
            {MAX_CARD_SPARKLES.map((p, i) => (
              <span key={i} className="absolute text-sm" style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }}>
                ✦
              </span>
            ))}
          </div>
        </>
      )}

      {isMax ? (
        <p className="relative text-center text-sm font-black tracking-widest text-white drop-shadow-[0_0_10px_rgba(250,204,21,0.9)]">
          🏆 PERFECT CLEAR!! 🏆
        </p>
      ) : isFinalTrial ? (
        <p className="relative text-center text-xs font-black tracking-widest text-amber-300">⚡ FINAL DOPA TRIAL ⚡</p>
      ) : isOverdrive ? (
        <p className="relative text-center text-xs font-black tracking-widest text-amber-300">⚡ DOPA OVERDRIVE ⚡</p>
      ) : (
        <p className="relative text-center text-xs font-bold tracking-widest text-fuchsia-300">ドパガキゲーム</p>
      )}

      <p className="relative mt-2 text-center text-xs font-bold text-white/40">ドパガキ度</p>
      <p
        className={`relative text-center text-7xl font-black tabular-nums leading-none drop-shadow-[0_0_30px_rgba(217,70,239,0.5)] ${percentColor} ${
          isMax ? 'drop-shadow-[0_0_35px_rgba(250,204,21,0.9)]' : ''
        }`}
      >
        {result.percent}
        <span className="text-3xl">％</span>
      </p>

      <p className={`relative mt-3 text-center text-lg font-black ${isOverdrive ? 'text-amber-200' : 'text-fuchsia-300'}`}>
        {result.type.name}
      </p>

      {result.finalTrial && (
        <p className="relative mt-1 text-center text-sm font-black tracking-widest text-white/70">
          FINAL DOPA TRIAL {result.finalTrial.trialsCleared} / 16
        </p>
      )}

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

      <p className="mt-5 text-center text-[11px] font-bold text-white/40">
        {isMax ? '完全ノーミスでの完全攻略。' : isFinalTrial ? 'FINAL DOPA TRIALで力尽きた。' : '100％いける？'}
      </p>
    </div>
  )

  // Ver.4.11: 120%（PERFECT CLEAR）だけ、カードの外側に虹色プレミアムボーダーを回す
  // （カード自身はoverflow-hiddenのため、ボーダーの疑似要素は別のラッパーに付ける）。
  if (isMax) {
    return (
      <div className="rainbow-premium-border w-full max-w-xs rounded-3xl p-[3px]">
        {card}
      </div>
    )
  }

  return <div className="w-full max-w-xs">{card}</div>
}
