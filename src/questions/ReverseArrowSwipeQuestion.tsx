import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

/**
 * Ver.4.9で追加。「矢印と逆にスワイプ！」：認知抑制系。表示された矢印と正反対の方向へ
 * スワイプすればSUCCESS、矢印と同じ方向（または他の方向）へスワイプしたらMISS。
 * ArrowSwipeと同じ操作感（スワイプ）だが判断が一段階増えるため、humanMinTimeを長くし、
 * questionPicker側のカテゴリ連続回避（gesture）でArrowSwipe等と連続しすぎないようにする。
 */
const DIRECTIONS = [
  { id: 'up', arrow: '↑', opposite: 'down' },
  { id: 'down', arrow: '↓', opposite: 'up' },
  { id: 'left', arrow: '←', opposite: 'right' },
  { id: 'right', arrow: '→', opposite: 'left' },
] as const

const SWIPE_THRESHOLD_PX = 45

function generate() {
  return { direction: pick(DIRECTIONS) }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.reverseArrowSwipe.minTimeMs
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
      return
    }
    const actual = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    finish(actual === direction.opposite)
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
      <QuestionShell sub="表示と反対の向きへ" instruction={'矢印と逆に\nスワイプ！'}>
        <p className="text-8xl font-black text-red-300 drop-shadow-[0_0_20px_rgba(248,113,113,0.5)]">{direction.arrow}</p>
      </QuestionShell>
    </div>
  )
}

export const ReverseArrowSwipeQuestionModule: QuestionModule = {
  id: 'reverseArrowSwipe',
  category: 'gesture',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
