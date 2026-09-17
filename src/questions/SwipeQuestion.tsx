import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import type { QuestionComponentProps, QuestionModule } from '../types'

const DIRECTIONS = [
  { id: 'up', label: '上にスワイプ！', arrow: '↑' },
  { id: 'down', label: '下にスワイプ！', arrow: '↓' },
  { id: 'left', label: '左にスワイプ！', arrow: '←' },
  { id: 'right', label: '右にスワイプ！', arrow: '→' },
]

function generate() {
  return { direction: pick(DIRECTIONS) }
}

const SWIPE_THRESHOLD_PX = 40

function Component({ spec, onResult }: QuestionComponentProps) {
  const { direction } = spec.data as { direction: (typeof DIRECTIONS)[0] }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return
    const actual = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    finish(actual === direction.id)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-6"
    >
      <p className="text-3xl font-black text-white">{direction.label}</p>
      <p className="text-7xl">{direction.arrow}</p>
    </div>
  )
}

export const SwipeQuestionModule: QuestionModule = {
  id: 'swipe',
  category: 'reaction',
  baseTargetTimeMs: 1500,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.swipe.minTimeMs,
}
