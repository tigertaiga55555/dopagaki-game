import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

/**
 * Ver.4.9で追加。「矢印の方向へスワイプ！」：中央に大きく表示した矢印と同じ方向へ
 * スワイプすればSUCCESS。単純なタップだけ（移動量が閾値未満）ではすぐMISSにせず、
 * 短く無視して待つ（＝もう一度スワイプし直す猶予を与える）。斜め入力は
 * 縦横どちらが優勢かで判定するため、ある程度寛容に成功する。
 */
const DIRECTIONS = [
  { id: 'up', arrow: '↑' },
  { id: 'down', arrow: '↓' },
  { id: 'left', arrow: '←' },
  { id: 'right', arrow: '→' },
] as const

const SWIPE_THRESHOLD_PX = 45

function generate() {
  return { direction: pick(DIRECTIONS) }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.arrowSwipe.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { direction } = spec.data as { direction: (typeof DIRECTIONS)[number] }
  const startRef = useRef(performance.now())
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    // 指がスワイプ中にコンテナの視覚的な範囲外へ出ても、pointerup/pointermoveを
    // 確実にこの要素へ届けるためexplicit pointer captureを取る。
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) {
      // タップだけ、または移動量が足りない＝即MISSにせず無視する（もう一度スワイプできる）
      return
    }
    const actual = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    finish(actual === direction.id)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
      }}
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-6"
    >
      <QuestionShell instruction={'矢印の方向へ\nスワイプ！'}>
        <p className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{direction.arrow}</p>
      </QuestionShell>
    </div>
  )
}

export const ArrowSwipeQuestionModule: QuestionModule = {
  id: 'arrowSwipe',
  category: 'gesture',
  baseTargetTimeMs: 1500,
  generate,
  Component,
  computeMinTargetTimeMs,
}
