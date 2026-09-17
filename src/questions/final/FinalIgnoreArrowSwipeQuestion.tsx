import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { pick } from '../../engine/random'
import { createResolveOnce } from '../../engine/resolveOnce'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const DIRECTIONS = [
  { id: 'up', arrow: '↑', word: 'うえ' },
  { id: 'down', arrow: '↓', word: 'した' },
  { id: 'left', arrow: '←', word: 'ひだり' },
  { id: 'right', arrow: '→', word: 'みぎ' },
] as const
type DirId = (typeof DIRECTIONS)[number]['id']

const SWIPE_THRESHOLD_PX = 45

function dirById(id: DirId) {
  return DIRECTIONS.find((d) => d.id === id)!
}

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「矢印は無視！文字の方向へ
 * スワイプ！」。FinalIgnoreTextSwipeQuestionの対になるストループ課題。今度は矢印を無視し、
 * 文字が示す方向へそのままスワイプする（逆方向にはしない）。
 */
function generate() {
  const arrowDir = pick(DIRECTIONS).id
  const textDir = pick(DIRECTIONS).id
  return { arrowDir, textDir, target: textDir }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { arrowDir, textDir, target } = spec.data as { arrowDir: DirId; textDir: DirId; target: DirId }
  const startRef = useRef(performance.now())
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
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
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!dragStartRef.current || guardRef.current!.isResolved) return
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
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <p className="whitespace-pre-line text-2xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
        矢印は無視！{'\n'}文字の方向へスワイプ！
      </p>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xl font-black text-white/50">{dirById(textDir).word}</p>
        <p className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{dirById(arrowDir).arrow}</p>
      </div>
    </div>
  )
}

export const FinalIgnoreArrowSwipeModule: FinalQuestionModule = {
  id: 'finalIgnoreArrowSwipe',
  tags: ['swipe', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
