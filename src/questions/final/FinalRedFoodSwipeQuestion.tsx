import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, pickExcluding } from '../../engine/random'
import { sfx } from '../../utils/sound'
import { useInputGateReady } from '../useInputGateReady'
import { useQuestionStartRef } from '../useQuestionStartRef'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const SWIPE_THRESHOLD_PX = 50
const BADGE_SHAPE: ShapeId = 'circle'

const FOOD_ICONS = ['🍎', '🍓', '🌶️', '🍌', '🍇', '🥦']
const NONFOOD_ICONS = ['🚗', '❤️', '🎈', '⭐', '📱', '🎸']

/**
 * Ver.6 Phase 1: 旧「赤い食べ物は右、それ以外は左！」（色識別が正解条件の半分だった
 * 問題）を再設計した。「赤である」の代わりに、カードの隅に図形バッジ（○固定）を
 * 付け、「バッジが○である」＋「食べ物である」のAND条件にした。バッジが○なのに
 * 食べ物じゃない物・食べ物なのにバッジが○じゃない物をディストラクターとして混ぜ、
 * 単一条件だけでの誤判断を誘発する構成は旧実装を踏襲している。
 */
function generate() {
  const isFood = Math.random() < 0.5
  const icon = isFood ? pick(FOOD_ICONS) : pick(NONFOOD_ICONS)
  const hasBadge = Math.random() < 0.5
  const badgeShape = hasBadge ? BADGE_SHAPE : pickExcluding(SHAPE_IDS, BADGE_SHAPE)
  const isRightAnswer = isFood && hasBadge
  return { icon, badgeShape, isRightAnswer }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { icon, badgeShape, isRightAnswer } = spec.data as { icon: string; badgeShape: ShapeId; isRightAnswer: boolean }
  const startRef = useQuestionStartRef()
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const ready = useInputGateReady()

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (!ready) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!ready || !dragStartRef.current || guardRef.current!.isResolved) return
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
        <span className="text-amber-300">{SHAPE_LABELS[BADGE_SHAPE]}の食べ物は右へ →</span>
      </div>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2">
        <div className="relative">
          <p className="text-8xl">{icon}</p>
          <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <ShapeIcon shape={badgeShape} size={20} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const FinalRedFoodSwipeModule: FinalQuestionModule = {
  id: 'finalRedFoodSwipe',
  tags: ['swipe', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
