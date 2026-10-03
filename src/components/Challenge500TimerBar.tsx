import { useEffect, useRef, useState } from 'react'
import { useInputGateReady } from '../questions/useInputGateReady'

interface Props {
  limitMs: number
  onTimeout: () => void
}

/**
 * Ver.6 Phase 1（再設計版）: 500%チャレンジの全tier・全問題タイプ共通の制限時間を
 * 可視化するバー。ユーザー指示により「問題の複雑さやtierで制限時間を調整しない」ため、
 * limitMsは呼び出し元（Challenge500Screen）がCHALLENGE500_CONFIG.questionTimeLimitMsを
 * そのまま渡すだけの単一値になる。
 *
 * 既存の反応速度計測修正（useInputGateReady）と同じ「画面が実際にペイントされるまで
 * 計測を始めない」原則をここでも踏襲し、マウント直後の同期計測による不当な時間切れを防ぐ。
 * 時間切れはonTimeoutを1回だけ呼び（firedRefで多重発火を防止）、呼び出し元がMISS扱いに
 * する。問題側のonPointerDown（タップ判定）とは独立しているが、Challenge500Screen側で
 * 「どちらか先に解決した方だけを採用する」ガードを持つため、タイムアウトと正解判定の
 * 競合は発生しない。
 *
 * 色は使わず、バーの長さ（＝残り時間の比率）だけで残り時間を示す。
 */
export function Challenge500TimerBar({ limitMs, onTimeout }: Props) {
  const ready = useInputGateReady()
  const [ratio, setRatio] = useState(1)
  const firedRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!ready) return
    const startedAt = performance.now()
    function tick() {
      const elapsed = performance.now() - startedAt
      const nextRatio = Math.max(0, 1 - elapsed / limitMs)
      setRatio(nextRatio)
      if (elapsed >= limitMs) {
        if (!firedRef.current) {
          firedRef.current = true
          onTimeout()
        }
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <div
        className={`h-full rounded-full bg-amber-300 ${ratio > 0.01 ? 'transition-[width] duration-100 ease-linear' : ''}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
