import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick } from '../../engine/random'
import { sfx } from '../../utils/sound'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const SWIPE_THRESHOLD_PX = 50

const RED_FOOD = [
  { icon: '🍎', hex: '#ef4444' },
  { icon: '🍓', hex: '#ef4444' },
  { icon: '🌶️', hex: '#ef4444' },
]
const NON_RED_FOOD = [
  { icon: '🍌', hex: '#eab308' },
  { icon: '🍇', hex: '#a855f7' },
  { icon: '🥦', hex: '#22c55e' },
]
const RED_NONFOOD = [
  { icon: '🚗', hex: '#ef4444' },
  { icon: '❤️', hex: '#ef4444' },
  { icon: '🎈', hex: '#ef4444' },
]
const NONRED_NONFOOD = [
  { icon: '⭐', hex: '#eab308' },
  { icon: '📱', hex: '#3b82f6' },
  { icon: '🎸', hex: '#a855f7' },
]

type Category = 'redFood' | 'nonRedFood' | 'redNonFood' | 'nonRedNonFood'
const POOLS: Record<Category, { icon: string; hex: string }[]> = {
  redFood: RED_FOOD,
  nonRedFood: NON_RED_FOOD,
  redNonFood: RED_NONFOOD,
  nonRedNonFood: NONRED_NONFOOD,
}
const CATEGORIES: Category[] = ['redFood', 'nonRedFood', 'redNonFood', 'nonRedNonFood']

/**
 * FINAL DOPA TRIAL Q5〜Q8（2条件処理プール）：「赤い食べ物は右、それ以外は左へスワイプ！」。
 * 「赤色である」＋「食べ物である」のAND条件。赤いのに食べ物じゃない物（❤️等）・
 * 食べ物なのに赤くない物（🍌等）をディストラクターとして混ぜ、単一条件だけでの
 * 誤判断を誘発する。
 */
function generate() {
  const category = pick(CATEGORIES)
  const item = pick(POOLS[category])
  const isRightAnswer = category === 'redFood'
  return { icon: item.icon, hex: item.hex, isRightAnswer }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { icon, isRightAnswer } = spec.data as { icon: string; hex: string; isRightAnswer: boolean }
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

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
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    const wentRight = dx > 0
    if (wentRight === isRightAnswer) sfx.swipeSuccess()
    finish(wentRight === isRightAnswer)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
      }}
      className="relative flex h-full w-full touch-none select-none flex-col items-center gap-4 pt-3"
    >
      <div className="relative z-10 flex w-full max-w-xs items-center justify-between px-1 text-xs font-black">
        <span className="text-sky-300">← それ以外は左へ</span>
        <span className="text-red-300">赤い食べ物は右へ →</span>
      </div>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <p className="text-8xl">{icon}</p>
      </div>
    </div>
  )
}

export const FinalRedFoodSwipeModule: FinalQuestionModule = {
  id: 'finalRedFoodSwipe',
  tags: ['color', 'swipe', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
