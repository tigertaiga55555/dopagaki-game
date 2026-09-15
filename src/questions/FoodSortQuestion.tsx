import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule } from '../types'

const FOOD_ICONS = ['🍎', '🍌', '🍇', '🍕', '🍔', '🍣', '🍩', '🍞']
const OTHER_ICONS = ['🚗', '⚽', '🎈', '⭐', '🚀', '🎸', '📱', '👟']

const SWIPE_THRESHOLD_PX = 50

/**
 * 「高速仕分け」：Ver.4.3で復活。「← 食べ物  それ以外 →」というルールを
 * 出題中ずっと固定表示し、方向だけを指示する旧swipeより明確に自己説明できるようにした。
 */
function generate() {
  const isFood = Math.random() < 0.5
  const icon = isFood ? pick(FOOD_ICONS) : pick(OTHER_ICONS)
  return { isFood, icon }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { isFood, icon } = spec.data as { isFood: boolean; icon: string }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [dragX, setDragX] = useState(0)

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
  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragStartRef.current) return
    setDragX((e.clientX - dragStartRef.current.x) * 0.4)
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    dragStartRef.current = null
    setDragX(0)
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    const wentLeft = dx < 0
    const correct = wentLeft === isFood
    if (correct) sfx.swipeSuccess()
    finish(correct)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
        setDragX(0)
      }}
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-10"
    >
      <p className="text-2xl font-black text-white">← 食べ物  それ以外 →</p>
      <p className="text-8xl" style={{ transform: `translateX(${dragX}px)` }}>
        {icon}
      </p>
    </div>
  )
}

export const FoodSortQuestionModule: QuestionModule = {
  id: 'foodSort',
  category: 'reaction',
  baseTargetTimeMs: 1600,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.foodSort.minTimeMs,
}
