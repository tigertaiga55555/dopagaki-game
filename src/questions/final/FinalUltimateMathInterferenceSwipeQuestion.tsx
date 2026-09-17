import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { randInt, pick } from '../../engine/random'
import { createResolveOnce } from '../../engine/resolveOnce'
import { sfx } from '../../utils/sound'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const DIRECTIONS = [
  { id: 'up', arrow: '↑', word: '上', opposite: 'down' },
  { id: 'down', arrow: '↓', word: '下', opposite: 'up' },
  { id: 'left', arrow: '←', word: '左', opposite: 'right' },
  { id: 'right', arrow: '→', word: '右', opposite: 'left' },
] as const
type DirId = (typeof DIRECTIONS)[number]['id']

const SWIPE_THRESHOLD_PX = 50
const FLY_MS = 160
const PER_REMAINING_SWIPE_MS = TIMING_SAFETY.shortVideoSwipe.perSwipeMs + 350

function dirById(id: DirId) {
  return DIRECTIONS.find((d) => d.id === id)!
}

/**
 * ULTIMATE QUESTION候補5（計算＋干渉＋逆操作＋複数スワイプ）：「文字は無視！矢印と逆方向へ
 * 答えの回数スワイプ！」。既存Q13〜15のFinalMathReverseSwipeQuestion（計算＋方向反転＋反復）に、
 * FinalIgnoreTextSwipeQuestion由来のストループ干渉語（無視すべき方向を表す漢字1文字）を
 * 追加することで、「無視すべき情報を切り捨てる」処理ステップを1段階増やした最終形。
 * 計算結果は2〜4に限定し（過剰な物理操作を要求しない）、干渉語は矢印方向と独立に決めるため
 * 一致することもあれば矛盾することもある（どちらの場合も文字は常に無視が正解）。
 */
function generate() {
  const direction = pick(DIRECTIONS).id
  const wordDirId = pick(DIRECTIONS).id
  const sum = randInt(2, 4)
  const a = randInt(1, sum - 1)
  const b = sum - a
  return { a, b, direction, wordDirId, required: sum }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.ultimate5Ms
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { a, b, direction, wordDirId, required } = spec.data as {
    a: number
    b: number
    direction: DirId
    wordDirId: DirId
    required: number
  }
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
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p className="whitespace-pre-line text-2xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
        文字は無視！{'\n'}矢印と逆方向へ{'\n'}答えの回数スワイプ！
      </p>
      <p className="text-xl font-black text-white/70">
        {a} ＋ {b} ＝ ？
      </p>
      <p className="text-lg font-black text-white/40">{dirById(wordDirId).word}</p>
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

export const FinalUltimateMathInterferenceSwipeModule: FinalQuestionModule = {
  id: 'finalUltimateMathInterferenceSwipe',
  tags: ['math', 'swipe', 'reverse', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
