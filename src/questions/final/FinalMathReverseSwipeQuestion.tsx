import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { randInt } from '../../engine/random'
import { createResolveOnce } from '../../engine/resolveOnce'
import { sfx } from '../../utils/sound'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const DIRECTIONS = [
  { id: 'up', arrow: '↑', opposite: 'down' },
  { id: 'down', arrow: '↓', opposite: 'up' },
  { id: 'left', arrow: '←', opposite: 'right' },
  { id: 'right', arrow: '→', opposite: 'left' },
] as const
type DirId = (typeof DIRECTIONS)[number]['id']

const SWIPE_THRESHOLD_PX = 50
const FLY_MS = 160
/** 1回の正しいスワイプ後、残りスワイプぶんの猶予を確保するための1回あたりの見込み時間 */
const PER_REMAINING_SWIPE_MS = TIMING_SAFETY.shortVideoSwipe.perSwipeMs + 350

function dirById(id: DirId) {
  return DIRECTIONS.find((d) => d.id === id)!
}

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「矢印と逆方向へ計算の答えの回数
 * スワイプ！」。計算（答えの回数だけ）＋方向反転＋反復操作の複合。回数はShortVideoSwipeと
 * 同じ「カードが飛んでいく＋残数表示」UIで視覚的に分かるようにする。
 */
function generate() {
  const a = randInt(1, 3)
  const b = randInt(1, 2)
  const answer = a + b // 2〜3回に収める（人間の反復操作として現実的な回数）
  const direction = DIRECTIONS[randInt(0, 3)].id
  return { a, b, direction, required: answer }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { a, b, direction, required } = spec.data as { a: number; b: number; direction: DirId; required: number }
  const target = dirById(direction).opposite
  const [swipedCount, setSwipedCount] = useState(0)
  const [flying, setFlying] = useState(false)
  const swipedCountRef = useRef(0)
  const startRef = useRef(performance.now())
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (guardRef.current!.isResolved || flying) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (guardRef.current!.isResolved || flying || !dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return
    const actual = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    if (actual !== target) {
      finish(false)
      return
    }
    sfx.swipeSuccess()
    const next = swipedCountRef.current + 1
    setFlying(true)
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (next < required) {
      const remaining = required - next
      failTimerRef.current = setTimeout(() => finish(false), remaining * PER_REMAINING_SWIPE_MS + FLY_MS + 400)
    }
    flyTimerRef.current = setTimeout(() => {
      if (next >= required) {
        finish(true)
        return
      }
      swipedCountRef.current = next
      setSwipedCount(next)
      setFlying(false)
    }, FLY_MS)
  }

  const remaining = required - swipedCount

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
        矢印と逆方向へ{'\n'}計算の答えの回数スワイプ！
      </p>
      <p className="text-xl font-black text-white/70">
        {a} ＋ {b} ＝ ？
      </p>
      <div
        className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white/10 text-7xl font-black text-white"
        style={{
          transform: flying ? 'scale(0.6)' : 'scale(1)',
          opacity: flying ? 0 : 1,
          transition: `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`,
        }}
      >
        {dirById(direction).arrow}
      </div>
      <p className="text-lg font-black text-amber-200/90">{remaining > 0 ? `あと${remaining}回` : '完了！'}</p>
    </div>
  )
}

export const FinalMathReverseSwipeModule: FinalQuestionModule = {
  id: 'finalMathReverseSwipe',
  tags: ['math', 'swipe', 'reverse'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
