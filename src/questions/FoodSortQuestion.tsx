import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule } from '../types'

const FOOD_ICONS = ['🍎', '🍌', '🍇', '🍕', '🍔', '🍣', '🍩', '🍞']
const OTHER_ICONS = ['🚗', '⚽', '🎈', '⭐', '🚀', '🎸', '📱', '👟']

const SWIPE_THRESHOLD_PX = 50
/** 成功時、アイコンが仕分け方向へ飛んでいく演出の長さ */
const FLY_MS = 180

/**
 * Ver.4.3で復活、Ver.4.6でUI強化。「← 食べ物　｜　その他 →」というルールを
 * 上部に大きく高コントラストで固定表示し、背景演出に埋もれないようにした。
 * 成功時はアイコンが仕分け方向へ飛んでいく演出を追加し、「左右へ仕分けている」感覚を
 * 視覚的にも伝える。
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
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null)
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(timer)
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (doneRef.current || flyDirection) return
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragStartRef.current || flyDirection) return
    setDragX((e.clientX - dragStartRef.current.x) * 0.4)
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!dragStartRef.current || flyDirection) return
    const dx = e.clientX - dragStartRef.current.x
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
      setDragX(0)
      return
    }
    const wentLeft = dx < 0
    const correct = wentLeft === isFood
    if (!correct) {
      setDragX(0)
      finish(false)
      return
    }
    // 判定は今この瞬間に確定させ（doneRef true）、外側タイマーに書き換えられないようにしてから、
    // 演出（飛んでいく）のぶんだけ結果通知を遅らせる。
    sfx.swipeSuccess()
    doneRef.current = true
    setFlyDirection(wentLeft ? 'left' : 'right')
    flyTimerRef.current = setTimeout(() => {
      onResult({ correct: true, reactionMs: performance.now() - startRef.current })
    }, FLY_MS)
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
      className="flex h-full w-full touch-none select-none flex-col items-center gap-6 pt-3"
    >
      <div className="flex w-full max-w-xs items-center justify-between px-1">
        <div className="flex items-center gap-1 rounded-xl bg-emerald-500/25 px-3 py-1.5">
          <span className="text-xl font-black text-emerald-300">←</span>
          <span className="text-base font-black text-emerald-200">食べ物</span>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-sky-500/25 px-3 py-1.5">
          <span className="text-base font-black text-sky-200">その他</span>
          <span className="text-xl font-black text-sky-300">→</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p
          className="text-8xl"
          style={{
            transform: flyDirection
              ? `translateX(${flyDirection === 'left' ? -260 : 260}px) scale(0.5)`
              : `translateX(${dragX}px)`,
            opacity: flyDirection ? 0 : 1,
            transition: flyDirection ? `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in` : undefined,
          }}
        >
          {icon}
        </p>
      </div>
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
