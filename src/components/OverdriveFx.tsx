import { MILESTONE_TEXT } from '../config/messagesV4'

/**
 * Ver.4.7: 黄金DOPA OVERDRIVE演出の共有プレゼンテーション層。
 *
 * 実ゲーム（PlayScreen）とVercel Preview確認画面（OverdrivePreviewScreen）の両方から
 * 同じコンポーネントを使うことで、「Previewで見た演出」と「実際にOVERDRIVEが発動した時の
 * 演出」がほぼ同じになるようにしている（見た目のロジックはここに一本化）。
 *
 * 通常ゲームのロジック・スコア計算・OVERDRIVE発動条件・正誤判定・問題制限時間には
 * 一切関与しない、純粋な表示コンポーネント群。全要素にpointer-events-noneを設定し、
 * お題の操作を妨げない。中央60〜70%程度の問題表示領域には常に何も描画しない
 * （エッジ・背景・HUD周辺・外周にのみ演出を寄せる）。
 */

export type OverdriveTier = 0 | 1 | 2 | 3 | 4

/** percent（100超えの実測値）からOVERDRIVE演出の段階を決める。101未満は非OVERDRIVE。 */
export function getOverdriveTier(percent: number): OverdriveTier {
  if (percent < 101) return 0
  if (percent < 110) return 1
  if (percent < 115) return 2
  if (percent < 120) return 3
  return 4
}

const TIER_SIREN_MS: Record<OverdriveTier, number> = { 0: 900, 1: 850, 2: 650, 3: 420, 4: 260 }
const TIER_RING_MS: Record<OverdriveTier, number> = { 0: 1100, 1: 1100, 2: 900, 3: 650, 4: 420 }
const TIER_PARTICLE_COUNT: Record<OverdriveTier, number> = { 0: 0, 1: 0, 2: 4, 3: 6, 4: 8 }

/**
 * 中央60〜70%程度の問題表示領域には絶対にかからないよう、パーティクルは画面端の
 * 帯（左右それぞれ0〜15%・85〜100%）にのみ配置する（信号・色問題・通知色などの
 * 視認性を守るため）。
 */
const AMBIENCE_PARTICLE_SLOTS = [
  { x: 3, delay: 0 },
  { x: 9, delay: 0.3 },
  { x: 5, delay: 0.6 },
  { x: 12, delay: 0.9 },
  { x: 97, delay: 0.15 },
  { x: 91, delay: 0.45 },
  { x: 95, delay: 0.75 },
  { x: 88, delay: 1.05 },
]

/** frameClass（PlayScreen/Previewの外枠divに足すbox-shadowクラス）。tier===0なら空文字。 */
export function getOverdriveFrameClass(tier: OverdriveTier): string {
  return tier > 0 ? 'overdrive-ring' : ''
}

/**
 * 画面端の黄金サイレン（回転灯）＋外周の金色パーティクル。tier===0では何も描画しない。
 * 中央の問題表示領域には触れない（画面端に固定した細い帯とパーティクルのみ）。
 */
export function OverdriveAmbience({ tier }: { tier: OverdriveTier }) {
  if (tier === 0) return null
  const sirenMs = TIER_SIREN_MS[tier]
  const ringMs = TIER_RING_MS[tier]
  const particleCount = TIER_PARTICLE_COUNT[tier]

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" style={{ ['--ring-ms' as string]: `${ringMs}ms` }}>
      <div
        className="golden-siren-bar absolute inset-y-0 left-0 w-5"
        style={{ ['--siren-ms' as string]: `${sirenMs}ms`, animationDelay: '0ms' }}
      />
      <div
        className="golden-siren-bar absolute inset-y-0 right-0 w-5"
        style={{ ['--siren-ms' as string]: `${sirenMs}ms`, animationDelay: `${sirenMs / 2}ms` }}
      />
      {particleCount > 0 &&
        AMBIENCE_PARTICLE_SLOTS.slice(0, particleCount).map((p, i) => (
          <span
            key={i}
            className="anim-golden-particle absolute text-sm text-amber-300"
            style={{ left: `${p.x}%`, bottom: '4%', animationDelay: `${p.delay}s` }}
          >
            ✦
          </span>
        ))}
    </div>
  )
}

/**
 * 100%→101%突破の「上限を破壊した」演出。数字の震え（呼び出し側で anim-limit-shake を
 * 独自の%表示に付与）に続けて、グリッチ＋暗転＋「LIMIT ERROR」を一瞬だけ表示する。
 */
export function LimitErrorOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
      <div className="anim-glitch absolute inset-0 bg-amber-400" />
      <p className="anim-pop relative text-3xl font-black tracking-[0.2em] text-red-400">LIMIT ERROR</p>
    </div>
  )
}

/**
 * DOPA OVERDRIVE本体の到達演出。中央から金色衝撃波が広がる。
 * Ver.4.9: showTimeBonus=trueのとき、同じ演出の中で「+10 SEC」も一緒に見せる
 * （実ゲームでOVERDRIVE正式突入時に残り時間+10秒を加算するのはこの瞬間なので、
 * 新しい演出ビートを追加せずゲームテンポを止めすぎないようにする）。
 * Previewモードでは時間の概念がないためshowTimeBonusを渡さない＝falseのまま。
 */
export function OverdriveRevealOverlay({ show, showTimeBonus }: { show: boolean; showTimeBonus?: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85">
      <div className="anim-golden-vignette absolute inset-0" />
      <div className="anim-golden-shockwave absolute h-24 w-24 rounded-full" />
      <div className="anim-glitch absolute inset-0 bg-amber-300" />
      <p className="anim-pop relative text-4xl font-black tracking-widest text-amber-300 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]">
        {MILESTONE_TEXT.overdrive}
      </p>
      {showTimeBonus && (
        <p className="anim-pop relative mt-2 text-2xl font-black tracking-widest text-white drop-shadow-[0_0_14px_rgba(250,204,21,0.9)]">
          +10 SEC
        </p>
      )}
    </div>
  )
}

/**
 * 120%到達＝「ゲームを完全攻略した」ことが一発で分かる専用CLEAR演出。
 * Ver.4.9: 120%はゲーム開始から完全ノーミスでしか到達できない別格の条件になったため、
 * 通常のOVERDRIVE演出（101〜119%）とはっきり区別できるよう「CLEAR!!」を大きく強調する。
 * 直前にWhiteFlashOverlay（白閃光）を挟んでから表示することで、「黄金+白の超強力な爆発」を作る。
 */
export function Golden120Overlay({ show, title }: { show: boolean; title: string }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-1 bg-black/90">
      <div className="anim-golden-vignette absolute inset-0" />
      <div className="anim-golden-shockwave absolute h-16 w-16 rounded-full" style={{ animationDuration: '1.1s' }} />
      <div className="anim-golden-shockwave absolute h-16 w-16 rounded-full" style={{ animationDelay: '0.15s', animationDuration: '1.1s' }} />
      <div className="anim-golden-shockwave absolute h-16 w-16 rounded-full" style={{ animationDelay: '0.3s', animationDuration: '1.1s' }} />
      <div className="anim-gold-burst absolute h-72 w-72 rounded-full bg-amber-300 blur-3xl" />
      <p className="relative text-5xl font-black tabular-nums leading-none text-amber-300 drop-shadow-[0_0_30px_rgba(250,204,21,0.9)]">
        120<span className="text-2xl">%</span>
      </p>
      <p className="anim-pop relative text-6xl font-black italic tracking-wider text-white drop-shadow-[0_0_25px_rgba(250,204,21,1)]">
        CLEAR!!
      </p>
      <p className="anim-pop relative mt-1 text-xl font-black tracking-widest text-amber-200">{title}</p>
    </div>
  )
}

/** Ver.4.9: 120%CLEAR演出の冒頭で一瞬だけ焚く、黄金爆発をさらに強く見せるための白閃光。 */
export function WhiteFlashOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return <div className="flash-white-overlay pointer-events-none absolute inset-0 z-50 bg-white" />
}
