import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const DIRECTIONS = [
  { id: 'up', arrow: '↑', opposite: 'down' },
  { id: 'down', arrow: '↓', opposite: 'up' },
  { id: 'left', arrow: '←', opposite: 'right' },
  { id: 'right', arrow: '→', opposite: 'left' },
] as const
type DirId = (typeof DIRECTIONS)[number]['id']

const SWIPE_THRESHOLD_PX = 45
const REVEAL_MS = 1400

function dirById(id: DirId) {
  return DIRECTIONS.find((d) => d.id === id)!
}

/**
 * FINAL DOPA TRIAL Q9〜Q12（記憶＋判断プール）：「矢印を覚えろ！」→「矢印と逆方向へ
 * スワイプ！」。矢印を一瞬見せて隠し、記憶した矢印の反対方向へスワイプさせる
 * （記憶＋方向反転の複合負荷）。
 */
function generate() {
  const direction = pick(DIRECTIONS).id
  return { direction, target: dirById(direction).opposite }
}

/** 回答フェーズだけの時間。矢印の記憶表示（REVEAL_MS）は別途保証されtimeoutに含めない。 */
function computeTargetTimeMs() {
  return TIMING_SAFETY.final.memoryAnswerMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { direction, target } = spec.data as { direction: DirId; target: DirId }
  const [revealed, setRevealed] = useState(true)
  const startRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setRevealed(false)
      startRef.current = performance.now()
      failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    }, REVEAL_MS)
    return () => {
      clearTimeout(revealTimer)
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: startRef.current !== null ? performance.now() - startRef.current : 0 })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (revealed) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (revealed || !dragStartRef.current || guardRef.current!.isResolved) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return
    const actual = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    finish(actual === target)
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
      <QuestionShell instruction={revealed ? '矢印を覚えろ！' : '覚えた矢印と\n逆方向へスワイプ！'}>
        {revealed ? (
          <p className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{dirById(direction).arrow}</p>
        ) : (
          <div className="h-28 w-28 rounded-full border-4 border-dashed border-white/20" />
        )}
      </QuestionShell>
    </div>
  )
}

export const FinalMemoryArrowReverseSwipeModule: FinalQuestionModule = {
  id: 'finalMemoryArrowReverseSwipe',
  tags: ['memory', 'swipe', 'reverse'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
