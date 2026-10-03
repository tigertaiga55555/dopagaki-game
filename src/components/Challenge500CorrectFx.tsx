import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface Challenge500CorrectFxHandle {
  /** 正解演出を即座に（再生中でも中断して）最初から再生し直す。 */
  trigger: () => void
}

/**
 * Sparkle120Overlay（components/OverdriveFx.tsx）と全く同じ8箇所の配置・色・グリフを使う。
 * 見た目を1pxも変えないための複製であり、意図的な重複（OverdriveFx側はshowの真偽で
 * マウント/アンマウントする設計のため、常駐させたいこのコンポーネント用には使い回せない）。
 */
const SPARKLE_SLOTS = [
  { x: 8, y: 15, color: '#facc15', glyph: '✦' },
  { x: 92, y: 18, color: '#ffffff', glyph: '✧' },
  { x: 6, y: 55, color: '#5cc8ff', glyph: '✦' },
  { x: 94, y: 58, color: '#ff5757', glyph: '✦' },
  { x: 14, y: 82, color: '#7dfcae', glyph: '✧' },
  { x: 86, y: 84, color: '#b98bff', glyph: '✦' },
  { x: 50, y: 8, color: '#facc15', glyph: '✧' },
  { x: 50, y: 92, color: '#ffffff', glyph: '✦' },
]
const SPARKLE_DELAYS_MS = [0, 100, 250, 150, 400, 300, 200, 450]

/** index.cssのflash-white（0.3s ease-out）と同じ進行だが、paintが重いbackground-color
 *  ではなくcompositor合成だけで済むopacityで同じ「白い閃光」を再現する。 */
const FLASH_KEYFRAMES: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 0.95, offset: 0.35 },
  { opacity: 0, offset: 1 },
]

/** index.cssのsparkle-pop（1.8s ease-out forwards）と同じキーフレーム。 */
const SPARKLE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'scale(0.3) rotate(0deg)', offset: 0 },
  { opacity: 1, transform: 'scale(1.15) rotate(45deg)', offset: 0.2 },
  { opacity: 0.8, transform: 'scale(1.15) rotate(45deg)', offset: 0.7 },
  { opacity: 0, transform: 'scale(0.5) rotate(90deg)', offset: 1 },
]

/**
 * 500%チャレンジの「正解するたび」専用の軽量エフェクト層（パフォーマンス最適化版）。
 *
 * 旧実装は正解のたびにReact stateで<Sparkle120Overlay>と白フラッシュdivを
 * マウント→900ms後にアンマウントしており、「問題の切り替え（questionツリーの
 * unmount/mount）」と「演出DOMの新規生成」が同じコミットに重なることでiPhone実機で
 * 可視的なカクつきを引き起こしていた。
 *
 * この版は見た目（グリフ・座標・色・不透明度カーブ・時間）を1つも変えずに、
 * 9個のDOM要素（フラッシュ1枚＋sparkle8個）を画面の間ずっと常駐させ、
 * trigger()が呼ばれるたびにWeb Animations APIで同じキーフレームを再生し直すだけに
 * している。これにより、正解のたびにReactの再レンダー・DOM生成/破棄が一切発生しない
 * （Challenge500Screen側はref越しに命令的に呼ぶだけで、このコンポーネント自身は
 * 自分のstateを一切持たない＝親の再レンダーも誘発しない）。
 */
export const Challenge500CorrectFx = forwardRef<Challenge500CorrectFxHandle>(function Challenge500CorrectFx(_props, ref) {
  const flashRef = useRef<HTMLDivElement>(null)
  const sparkleRefs = useRef<(HTMLSpanElement | null)[]>([])
  const activeAnimsRef = useRef<Animation[]>([])

  useImperativeHandle(ref, () => ({
    trigger() {
      activeAnimsRef.current.forEach((anim) => anim.cancel())
      activeAnimsRef.current = []

      const flashEl = flashRef.current
      if (flashEl) {
        activeAnimsRef.current.push(flashEl.animate(FLASH_KEYFRAMES, { duration: 300, easing: 'ease-out' }))
      }
      sparkleRefs.current.forEach((el, i) => {
        if (!el) return
        activeAnimsRef.current.push(
          el.animate(SPARKLE_KEYFRAMES, { duration: 1800, delay: SPARKLE_DELAYS_MS[i], easing: 'ease-out', fill: 'forwards' }),
        )
      })
    },
  }))

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
      <div ref={flashRef} className="absolute inset-0 bg-white opacity-0" />
      <div className="absolute inset-0 z-[52]">
        {SPARKLE_SLOTS.map((s, i) => (
          <span
            key={i}
            ref={(el) => {
              sparkleRefs.current[i] = el
            }}
            className="absolute text-2xl opacity-0"
            style={{ left: `${s.x}%`, top: `${s.y}%`, color: s.color }}
          >
            {s.glyph}
          </span>
        ))}
      </div>
    </div>
  )
})
