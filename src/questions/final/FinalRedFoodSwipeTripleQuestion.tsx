import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { shuffle } from '../../engine/random'
import { sfx } from '../../utils/sound'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const SWIPE_THRESHOLD_PX = 50
const FLY_MS = 170
const REQUIRED = 3
const PER_REMAINING_MS = TIMING_SAFETY.shortVideoSwipe.perSwipeMs + 400

const RED_FOOD = ['🍎', '🍓', '🌶️']
const NON_RED_FOOD = ['🍌', '🍇', '🥦']
const RED_NONFOOD = ['🚗', '❤️', '🎈']
const NONRED_NONFOOD = ['⭐', '📱', '🎸']
type Category = 'redFood' | 'nonRedFood' | 'redNonFood' | 'nonRedNonFood'
const POOLS: Record<Category, string[]> = { redFood: RED_FOOD, nonRedFood: NON_RED_FOOD, redNonFood: RED_NONFOOD, nonRedNonFood: NONRED_NONFOOD }
const CATEGORIES: Category[] = ['redFood', 'nonRedFood', 'redNonFood', 'nonRedNonFood']

function randomItem() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
  const icon = POOLS[category][Math.floor(Math.random() * POOLS[category].length)]
  return { icon, isRightAnswer: category === 'redFood' }
}

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「赤い食べ物は右、それ以外は左！」を
 * 3カード連続。FinalRedFoodSwipeQuestion（twoConditionプール）の高難度版で、3回連続で
 * 正しく仕分けきるまでSUCCESSにならない。1回でも方向を間違えると即MISS。
 */
function generate() {
  const items = shuffle(Array.from({ length: REQUIRED }, randomItem))
  return { items }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items } = spec.data as { items: { icon: string; isRightAnswer: boolean }[] }
  const [cardIndex, setCardIndex] = useState(0)
  const [flying, setFlying] = useState(false)
  const cardIndexRef = useRef(0)
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
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    const wentRight = dx > 0
    const isRightAnswer = items[cardIndexRef.current].isRightAnswer
    if (wentRight !== isRightAnswer) {
      finish(false)
      return
    }
    sfx.swipeSuccess()
    const next = cardIndexRef.current + 1
    setFlying(true)
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (next < REQUIRED) {
      const remaining = REQUIRED - next
      failTimerRef.current = setTimeout(() => finish(false), remaining * PER_REMAINING_MS + FLY_MS + 400)
    }
    flyTimerRef.current = setTimeout(() => {
      if (next >= REQUIRED) {
        finish(true)
        return
      }
      cardIndexRef.current = next
      setCardIndex(next)
      setFlying(false)
    }, FLY_MS)
  }

  const remaining = REQUIRED - cardIndex

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
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
        <p
          className="text-8xl"
          style={{
            transform: flying ? 'scale(0.6)' : 'scale(1)',
            opacity: flying ? 0 : 1,
            transition: `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`,
          }}
        >
          {items[cardIndex].icon}
        </p>
        <p className="text-lg font-black text-amber-200/90">{remaining > 0 ? `あと${remaining}枚` : '完了！'}</p>
      </div>
    </div>
  )
}

export const FinalRedFoodSwipeTripleModule: FinalQuestionModule = {
  id: 'finalRedFoodSwipeTriple',
  tags: ['color', 'swipe', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
