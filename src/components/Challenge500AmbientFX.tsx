import type { Challenge500ThemeParams } from '../config/challenge500Theme'

/**
 * Ver.6 Phase 3: 200〜500%「限界突破チャレンジ」の常駐アンビエント演出。
 *
 * challenge500Theme.tsが計算したテーマパラメータ（色・パーティクル数・pulse速度・
 * glow強度）を、CSS変数として各レイヤーに渡すだけの薄い描画層。アニメーションの
 * 実際の動き自体はすべてCSS側（index.cssのchallenge500-*キーフレーム）が担当するため、
 * JS側はrequestAnimationFrameループを一切持たない（パフォーマンス方針：
 * 常時DOM生成を避ける・rAF乱立を避ける・forced reflowを避ける）。
 *
 * パーティクル・光のストリークは固定スロット配列から必要数だけslice()する
 * （OverdriveFx.tsxのAMBIENCE_PARTICLE_SLOTSと同じ設計）。全テーマ共通で
 * パーティクル数の上限は10（challenge500Theme.ts側で保証済み）。
 *
 * 中央60〜70%程度の問題表示領域には一切かからないよう、パーティクル・ストリークは
 * 画面端の帯（左右0〜16%・84〜100%）にのみ配置する（既存のAMBIENCE_PARTICLE_SLOTSと
 * 同じ制約）。
 */

const PARTICLE_SLOTS = [
  { x: 3, delay: 0 },
  { x: 8, delay: 0.3 },
  { x: 13, delay: 0.6 },
  { x: 5, delay: 0.9 },
  { x: 10, delay: 1.2 },
  { x: 97, delay: 0.15 },
  { x: 92, delay: 0.45 },
  { x: 87, delay: 0.75 },
  { x: 95, delay: 1.05 },
  { x: 90, delay: 1.35 },
]

const STREAK_SLOTS = [
  { y: 18, delay: 0 },
  { y: 48, delay: 0.7 },
  { y: 78, delay: 1.4 },
]

export function Challenge500AmbientFX({ theme }: { theme: Challenge500ThemeParams }) {
  const { id, colorRgb, particleCount, pulseMs, glowMin, glowMax } = theme
  const pulseVars = {
    ['--c500-pulse-ms' as string]: `${pulseMs}ms`,
    ['--c500-glow-min' as string]: glowMin,
    ['--c500-glow-max' as string]: glowMax,
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* 呼吸するような背景グロー。色はテーマごとに異なり、速度・強度はtierProgressで連続的に変化する。 */}
      <div
        className="challenge500-breathe absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${colorRgb}, 0) 50%, rgba(${colorRgb}, 0.9) 100%)`,
          ...pulseVars,
        }}
      />

      {id === 'overload' &&
        STREAK_SLOTS.map((s, i) => (
          <div
            key={i}
            className="challenge500-streak absolute h-[2px] w-1/2"
            style={{
              top: `${s.y}%`,
              background: `linear-gradient(90deg, transparent, rgba(${colorRgb}, 0.9), transparent)`,
              ['--c500-streak-ms' as string]: `${Math.round(pulseMs * 1.1)}ms`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

      {id === 'danger' && (
        <>
          <div
            className={theme.tierProgress > 0.6 ? 'anim-warning-pulse-strong absolute inset-0' : 'anim-warning-pulse-weak absolute inset-0'}
          />
          <div className="anim-warning-flicker-layer absolute inset-0 bg-red-600/15" />
        </>
      )}

      {particleCount > 0 &&
        PARTICLE_SLOTS.slice(0, particleCount).map((p, i) => (
          <span
            key={i}
            className="challenge500-particle absolute h-1.5 w-1.5 rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: '6%',
              backgroundColor: `rgba(${colorRgb}, 0.9)`,
              boxShadow: `0 0 6px rgba(${colorRgb}, 0.8)`,
              ['--c500-particle-ms' as string]: `${Math.round(pulseMs * 1.15)}ms`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
    </div>
  )
}
