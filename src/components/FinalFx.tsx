/**
 * Ver.5.0: FINAL DOPA TRIAL専用の表示コンポーネント群。
 *
 * 100%OVERDRIVE突入演出（LimitErrorOverlay/OverdriveRevealOverlay、src/components/OverdriveFx.tsx）
 * と同じ思想で、ゲームロジック・正誤判定・タイマーには一切関与しない純粋な表示コンポーネント。
 * 全要素にpointer-events-noneを設定し、お題の操作を妨げない。中央の問題表示領域には
 * 強い色フィルターをかけない（7. 色問題の視認性を守るため、演出は背景・外周・HUD周辺に限定する）。
 */

/**
 * FINAL DOPA TRIAL中、常時うっすらと漂わせるプリズム／虹色エネルギーの背景装飾。
 * 画面端に固定した2つの回転グローのみで、中央60〜70%の問題表示領域には一切かからない。
 */
export function FinalWorldAmbience() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-40">
      <div
        className="anim-prism-spin absolute -left-16 -top-16 h-48 w-48 rounded-full blur-2xl"
        style={{ background: 'conic-gradient(from 0deg, #ff5757, #facc15, #7dfcae, #5cc8ff, #b98bff, #ff5757)' }}
      />
      <div
        className="anim-prism-spin absolute -right-16 -bottom-16 h-48 w-48 rounded-full blur-2xl"
        style={{ background: 'conic-gradient(from 180deg, #5cc8ff, #b98bff, #ff5757, #facc15, #7dfcae, #5cc8ff)', animationDirection: 'reverse' }}
      />
    </div>
  )
}

/** 120%到達＝FINAL DOPA TRIAL突入の瞬間、黄金HUDに一瞬ヒビが入るオーバーレイ。 */
export function HudCrackOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return <div className="anim-hud-crack pointer-events-none absolute inset-0 z-50" />
}

/**
 * 突入演出の核：「黄金世界が砕け散る」瞬間。既存のanim-glitch（amber）を土台に、
 * さらに白フラッシュの残光を重ねて「世界が壊れて塗り替わる」印象を強める。
 */
export function WorldShatterOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="anim-glitch absolute inset-0 bg-amber-300" />
      <div className="anim-glitch absolute inset-0 bg-white" style={{ animationDelay: '0.08s', mixBlendMode: 'overlay' }} />
    </div>
  )
}

/**
 * FINAL DOPA TRIAL突入バナー。「120% / OVERDRIVE BREAK」→「FINAL DOPA TRIAL / 16問連続正解せよ
 * / 1 MISS = END」の2段階テキストをbeatプロパティで切り替える
 * （14. 正確な秒数は説明しない。ルールだけを見せる）。
 */
export function FinalEntryTextOverlay({ beat }: { beat: 'breach' | 'rules' | null }) {
  if (!beat) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[55] flex flex-col items-center justify-center gap-2 text-center">
      {beat === 'breach' && (
        <>
          <p className="anim-pop text-7xl font-black tabular-nums text-amber-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.9)]">120%</p>
          <p className="anim-pop text-3xl font-black tracking-widest text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.7)]">
            OVERDRIVE BREAK
          </p>
        </>
      )}
      {beat === 'rules' && (
        <div className="anim-pop flex flex-col items-center gap-1.5 px-6">
          <p className="text-3xl font-black tracking-widest text-fuchsia-300 drop-shadow-[0_0_16px_rgba(232,121,249,0.8)]">
            FINAL DOPA TRIAL
          </p>
          <p className="text-lg font-bold text-white/85">16問連続正解せよ</p>
          <p className="text-xl font-black text-red-300">1 MISS = END</p>
        </div>
      )}
    </div>
  )
}

/**
 * FINAL DOPA TRIAL中、1問正解するたびの成功エフェクト。intensity（1〜5）に応じて
 * プリズム/黄金ショックウェーブのリング数・サイズを増やす（16. 小さめの演出、
 * 0.2〜0.4秒程度でテンポを崩さない：milestoneでない通常成功時は控えめに）。
 */
const SUCCESS_RING_COLORS = ['#facc15', '#ff5757', '#5cc8ff', '#7dfcae', '#b98bff']

export function FinalSuccessBurst({ judgementKey, intensity }: { judgementKey: number; intensity: 1 | 2 | 3 | 4 | 5 }) {
  const ringCount = Math.min(intensity, SUCCESS_RING_COLORS.length)
  return (
    <div key={judgementKey} className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="anim-gold-burst absolute h-24 w-24 rounded-full bg-amber-300/70 blur-2xl" />
      {SUCCESS_RING_COLORS.slice(0, ringCount).map((color, i) => (
        <div
          key={color}
          className="anim-rainbow-shockwave absolute h-12 w-12"
          style={{ animationDelay: `${i * 0.08}s`, ['--rainbow-color' as string]: color }}
        />
      ))}
    </div>
  )
}

/**
 * FINAL DOPA TRIAL失敗演出。黄金/虹の世界が崩れ落ち、暗く沈んでいく。
 * Ver.5.0追加修正: Q16 ULTIMATE QUESTIONで失敗した場合だけlabelを「ULTIMATE FAILED」に
 * 差し替える（8. 警告表示のまま失敗を伝える）。それ以外は従来通り「TRIAL FAILED」。
 */
export function FinalFailOverlay({
  show,
  percent,
  clearedCount,
  label = 'TRIAL FAILED',
}: {
  show: boolean
  percent: number
  clearedCount: number
  label?: string
}) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
      <div className="anim-prism-collapse absolute inset-0 bg-gradient-to-b from-red-950/60 via-black/40 to-black" />
      <p className="anim-pop relative text-4xl font-black tracking-widest text-red-400 drop-shadow-[0_0_16px_rgba(248,113,113,0.8)]">
        {label}
      </p>
      <p className="anim-pop relative text-2xl font-black tabular-nums text-white/80">{percent}%</p>
      <p className="anim-pop relative text-sm font-bold text-white/50">FINAL DOPA TRIAL {clearedCount} / 16</p>
    </div>
  )
}

/**
 * Ver.5.0追加修正: 15問目突破後、Q16「ULTIMATE QUESTION」へ入る専用の緊急警告演出。
 * 「新しいミニゲームではなく卒業試験」の重みを出すため、既存の地味な中継バナーを廃止し、
 * 赤＋黒＋非常警告の専用ワールドへ切り替える3ビート構成にした：
 * darken（暗転・静寂）→warning（赤フラッシュ＋WARNING）→banner（ULTIMATE QUESTION＋煽り文）。
 * 中央のテキスト自体は演出の主役のため強い色フィルターの制約対象外だが、
 * 外周のwarning-pulseリングは常に外周のみで中央を覆わない。
 */
export function UltimateIntroOverlay({ beat }: { beat: 'darken' | 'warning' | 'banner' | null }) {
  if (!beat) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black text-center">
      {(beat === 'warning' || beat === 'banner') && <div className="anim-warning-pulse-strong absolute inset-0" />}
      {beat === 'warning' && (
        <p className="anim-warning-flicker text-6xl font-black tracking-[0.3em] text-red-500 drop-shadow-[0_0_28px_rgba(239,68,68,0.9)]">
          WARNING
        </p>
      )}
      {beat === 'banner' && (
        <div className="anim-pop flex flex-col items-center gap-2 px-6">
          <p className="text-4xl font-black tracking-widest text-red-400 drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]">
            ULTIMATE QUESTION
          </p>
          <p className="text-base font-bold text-white/80">これを解けば200%</p>
        </div>
      )}
    </div>
  )
}

/**
 * Ver.5.0追加修正: Q16 ULTIMATE QUESTION回答中だけ表示する専用アンビエンス（赤＋黒）。
 * FinalWorldAmbience（黒＋白＋プリズム）から世界観を切り替えるが、突入演出中のstrongな
 * warning-pulseとは違い、ここでは弱いweak版のみを外周に薄く漂わせる
 * （5. 問題本編に入ったら警告演出を明確に弱め、中央の問題表示領域は一切妨げない）。
 */
export function UltimateWorldAmbience() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="anim-warning-pulse-weak absolute inset-0" />
      <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />
      <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-red-900/25 blur-3xl" />
    </div>
  )
}

/**
 * Ver.5.0追加修正(TASK D-2): 200% CLEARの一撃目。テキストは一切出さず、白フラッシュ＋
 * 黄金ショックウェーブ＋巨大なgold-burstだけで「ゲーム最大の一撃」を表現する
 * （溜め→無音の直後に来る、数字が出る前のprepなしの純粋な衝撃）。
 */
export function Clear200ImpactOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white">
      <div className="anim-golden-shockwave absolute h-24 w-24 rounded-full" style={{ animationDuration: '0.5s' }} />
      <div className="anim-gold-burst absolute h-96 w-96 rounded-full bg-amber-200 blur-3xl" />
    </div>
  )
}

/**
 * Ver.5.0追加修正(TASK D-3): 「200% SLAM」。一撃目の白閃光が引いた直後、奥から手前へ
 * 叩きつけるように「200%」が現れる瞬間。scale＋impact＋shockwave＋金色glow＋
 * プリズムエッジの全部盛りで、この数字自体が単独のミニ演出になるようにする。
 */
export function Clear200SlamOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black">
      <div className="anim-rainbow-shockwave absolute h-24 w-24" style={{ ['--rainbow-color' as string]: '#facc15' }} />
      <div className="anim-rainbow-shockwave absolute h-24 w-24" style={{ animationDelay: '0.12s', ['--rainbow-color' as string]: '#ffffff' }} />
      <div className="anim-gold-burst absolute h-64 w-64 rounded-full bg-amber-300/70 blur-3xl" />
      <p className="anim-pop relative text-7xl font-black tabular-nums leading-none text-white drop-shadow-[0_0_40px_rgba(250,204,21,1)]">
        200
        <span className="text-4xl text-amber-300">%</span>
      </p>
    </div>
  )
}

/**
 * 200% CLEAR演出専用の花火／星の追加レイヤー。既存のConfetti120Overlay／Sparkle120Overlayに
 * 重ねて使うことで「ゲーム史上最大」の密度を作る（C-4/C-5）。中央のテキストと重ならないよう
 * 外周・四隅寄り。waveを変える（=keyが変わる）たびにアニメーションが最初から再生され、
 * 音の「ドン！ドン！」に合わせて複数回まとめて打ち上がるように見せる。
 */
const FIREWORK_SLOTS = [
  { x: 20, y: 22, delay: 0, color: '#ff5757' },
  { x: 80, y: 20, delay: 0.2, color: '#5cc8ff' },
  { x: 15, y: 70, delay: 0.35, color: '#facc15' },
  { x: 85, y: 72, delay: 0.15, color: '#7dfcae' },
  { x: 50, y: 14, delay: 0.5, color: '#b98bff' },
  { x: 50, y: 88, delay: 0.28, color: '#ffffff' },
  { x: 8, y: 45, delay: 0.4, color: '#ffb347' },
  { x: 92, y: 45, delay: 0.1, color: '#5cc8ff' },
]

export function Fireworks200Overlay({ show, wave = 0 }: { show: boolean; wave?: number }) {
  if (!show) return null
  return (
    <div key={wave} className="pointer-events-none absolute inset-0 z-[52]">
      {FIREWORK_SLOTS.map((f, i) => (
        <div
          key={i}
          className="anim-rainbow-shockwave absolute h-10 w-10"
          style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.delay}s`, ['--rainbow-color' as string]: f.color }}
        />
      ))}
    </div>
  )
}
