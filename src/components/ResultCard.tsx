import type { FinalResultV4 } from '../types'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'

interface Props {
  result: FinalResultV4
  /**
   * Ver.5.0追加修正: 共有PNG生成専用のoffscreen cloneをレンダーする時だけtrueにする。
   * 実機（iPhone Safari）で「画像付きでシェア」のPNGにだけ、カード右側に細い黒帯・
   * 太い黒矩形・右下矩形が写り込む不具合が報告された。ライブ画面（このpropを渡さない
   * 通常表示）では一切発生しない。
   *
   * 原因: カード本体のdiv（`overflow-hidden` + `rounded-3xl` + `box-shadow`を同一要素に
   * 同居させている）が、border-radius＋overflow:hidden＋box-shadowという組み合わせの、
   * Safari/WebKit系エンジンで長年報告されている既知のレンダリング不具合パターンに
   * 一致する。通常のブラウザ合成パイプラインでは問題にならないが、html-to-imageが
   * この要素をSVGのforeignObjectへ複製しdata URI化した`<img>`として再ラスタライズする
   * 経路（ライブ画面では通らない、共有PNG生成時だけ通る特殊な経路）でこの組み合わせが
   * 壊れると考えられる（isolate/absolute overlay/mask/pseudo-element/filter/gradientの
   * 各layerを個別に無効化してPlaywright+html-to-imageで検証したが、これらはどれも
   * 単独では黒い矩形の発生・消失に影響しなかった。box-shadowが乗っている要素自体に
   * overflow-hiddenも同居している構造だけが全バリアント[通常/OVERDRIVE/isMax]に
   * 共通しており、Chromiumでは再現しないためWebKit固有と判断した）。
   *
   * 対策: forCapture時だけ、box-shadowをoverflow-hidden/rounded-3xlを持つ要素とは
   * 別の外側ラッパーへ分離する（box-shadowを持つ要素自身はoverflow:visibleのまま、
   * 角丸クリップは内側の別要素だけが担当する）。見た目はライブ画面と完全に同一のまま、
   * DOM構造だけを変える。ライブ画面側（forCapture未指定）は既存のまま1要素に
   * overflow-hidden+box-shadowが同居する、この変更前と全く同じ構造。
   */
  forCapture?: boolean
}

/** ゴールド結果カードの装飾パーティクル位置（画面端寄り、控えめな数に限定） */
const GOLD_CARD_PARTICLES = [
  { x: 6, y: 12 },
  { x: 92, y: 20 },
  { x: 10, y: 78 },
  { x: 88, y: 70 },
  { x: 50, y: 6 },
]

/**
 * Ver.4.11: 120%（PERFECT CLEAR）専用カードのsparkle装飾。金・白・虹を混ぜる。
 * Ver.5.0追加(TASK C-11): 200%専用カードとしてさらに豪華にするため、密度を増やした。
 */
const MAX_CARD_SPARKLES = [
  { x: 8, y: 8, color: '#facc15' },
  { x: 90, y: 10, color: '#ffffff' },
  { x: 5, y: 45, color: '#5cc8ff' },
  { x: 93, y: 48, color: '#ff5757' },
  { x: 10, y: 88, color: '#7dfcae' },
  { x: 88, y: 86, color: '#b98bff' },
  { x: 50, y: 4, color: '#ffffff' },
  { x: 20, y: 96, color: '#facc15' },
  { x: 80, y: 96, color: '#5cc8ff' },
  { x: 96, y: 28, color: '#facc15' },
  { x: 4, y: 28, color: '#ff5757' },
]

/** Ver.5.0追加(TASK C-11): 200%専用カードにだけ浮かべる金貨のあしらい。 */
const MAX_CARD_COINS = [
  { x: 14, y: 18 },
  { x: 86, y: 22 },
  { x: 12, y: 62 },
  { x: 88, y: 60 },
]

/**
 * Ver.5.0追加修正: カード下部の一言CTAは、isMax/isFinalTrialのような表示上の分岐ではなく、
 * result.percentだけを唯一の判定材料にする（ライブ画面・共有PNG・画像保存はすべて同じ
 * ResultCardをレンダーしているため、この関数を1箇所に置くだけで3経路が自動的に一致する）。
 * 以前はisMax/isFinalTrialで分岐しており、「finalTrialへ突入する前のOVERDRIVE（100〜119%）」が
 * どちらの分岐にも該当せず、進行と矛盾する固定文言「100％いける？」が表示される不具合があった。
 */
function getBottomStatusLine(percent: number): string {
  if (percent >= FINAL_TRIAL_CONFIG.clearPercent) return '完全攻略。'
  if (percent === FINAL_TRIAL_CONFIG.clearPercent - FINAL_TRIAL_CONFIG.percentPerCorrect) return 'あと1問。200％いける？'
  if (percent >= FINAL_TRIAL_CONFIG.startPercent) return '200％まで行ける？'
  if (percent >= 100) return 'FINALまで辿り着ける？'
  return '100％いける？'
}

export function ResultCard({ result, forCapture }: Props) {
  const isOverdrive = result.percent > 100
  // Ver.5.0: 「PERFECT CLEAR」「完全攻略」は200%（FINAL QUESTION正解）だけの専用表現。
  // 120%はもはやFINAL DOPA TRIALへの入口に過ぎないため、isMaxの基準をOVERDRIVE_CONFIG.maxPercent
  // （=120、useRushGame.ts側のOVERDRIVE上限capには今も使われる別概念の定数）から
  // FINAL_TRIAL_CONFIG.clearPercent（=200、真の完全攻略）へ切り替える。
  const isMax = result.percent >= FINAL_TRIAL_CONFIG.clearPercent
  // FINAL DOPA TRIALへ突入した（=result.finalTrialが存在する）が、200%まで到達できなかった場合。
  const isFinalTrial = !!result.finalTrial && !isMax
  const percentColor = isOverdrive ? 'text-amber-300' : result.percent >= 100 ? 'text-amber-200' : 'text-white'

  const shadowClass = isMax
    ? 'shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_0_110px_rgba(250,204,21,0.75)]'
    : isOverdrive
      ? 'shadow-[0_0_0_1px_rgba(250,204,21,0.4),0_0_60px_rgba(250,204,21,0.35)]'
      : 'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.5)]'

  const card = (
    <div
      className={`relative isolate w-full overflow-hidden rounded-3xl bg-gradient-to-b p-5 ${
        isMax ? 'from-[#2e2408] to-[#120a02]' : isOverdrive ? 'from-[#241606] to-[#0b0620]' : 'from-[#1c1033] to-[#0b0620]'
      } ${forCapture ? '' : shadowClass}`}
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
            {MAX_CARD_COINS.map((p, i) => (
              <span key={i} className="absolute text-base opacity-90" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                🪙
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
            <p key={line} className="whitespace-pre-line text-xs text-white/80">
              ・{line}
            </p>
          ))}
        </div>
      )}

      <p className="mt-4 whitespace-pre-line text-center text-sm font-bold text-white/70">「{result.comment}」</p>

      <p className="mt-5 text-center text-[11px] font-bold text-white/40">{getBottomStatusLine(result.percent)}</p>
    </div>
  )

  // forCapture時だけ、box-shadowをoverflow-hiddenを持たない別要素へ分離する（詳細はPropsのコメント参照）。
  const shadowSplit = forCapture ? <div className={`rounded-3xl ${shadowClass}`}>{card}</div> : card

  // Ver.4.11: 120%（PERFECT CLEAR）だけ、カードの外側に虹色プレミアムボーダーを回す
  // （カード自身はoverflow-hiddenのため、ボーダーの疑似要素は別のラッパーに付ける）。
  if (isMax) {
    return (
      <div className="rainbow-premium-border w-full max-w-xs rounded-3xl p-[3px]">
        {shadowSplit}
      </div>
    )
  }

  return <div className="w-full max-w-xs">{shadowSplit}</div>
}
