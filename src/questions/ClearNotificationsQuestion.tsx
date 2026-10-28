import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../components/ShapeIcon'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt, shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import { useQuestionStartRef } from './useQuestionStartRef'
import type { QuestionComponentProps, QuestionModule } from '../types'

interface Badge {
  id: number
  isTarget: boolean
  shape: ShapeId
}

/**
 * Ver.6 Phase 1: 旧「赤い通知だけ消せ！」（色識別が正解条件だった問題）を、
 * 対象図形の通知だけを消す課題に再設計。タイマー再設定ロジック等、既存の
 * バグ修正（Ver.4.6）はそのまま維持している。
 */
function generate() {
  const target = SHAPE_IDS[randInt(0, SHAPE_IDS.length - 1)]
  const targetCount = randInt(3, 4)
  const distractorCount = randInt(2, 3)
  const badges: Badge[] = [
    ...Array.from({ length: targetCount }, (_, i) => ({ id: i, isTarget: true, shape: target })),
    ...Array.from({ length: distractorCount }, (_, i) => ({
      id: targetCount + i,
      isTarget: false,
      shape: pickExcluding(SHAPE_IDS, target),
    })),
  ]
  return { badges: shuffle(badges), targetCount, target }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { targetCount } = data as { targetCount: number }
  return targetCount * TIMING_SAFETY.clearNotifications.perTargetMs + TIMING_SAFETY.clearNotifications.reactionBufferMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { badges, targetCount, target } = spec.data as { badges: Badge[]; targetCount: number; target: ShapeId }
  const [cleared, setCleared] = useState<Set<number>>(new Set())
  const startRef = useQuestionStartRef()
  const doneRef = useRef(false)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, clearedCount = 0) {
    if (doneRef.current) return
    doneRef.current = true
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    onResult({
      correct,
      reactionMs: performance.now() - startRef.current,
      meta: { targetsCleared: clearedCount, targetsTotal: targetCount },
    })
  }

  function handleTap(badge: Badge) {
    if (doneRef.current || cleared.has(badge.id)) return
    if (!badge.isTarget) {
      finish(false, cleared.size)
      return
    }
    const next = new Set(cleared)
    next.add(badge.id)
    setCleared(next)
    sfx.notifPop()
    if (next.size >= targetCount) {
      finish(true, next.size)
      return
    }
    // 正しく1個消すたびに、残り対象数ぶんの猶予で外側タイマーを引き直す。
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    const remaining = targetCount - next.size
    failTimerRef.current = setTimeout(
      () => finish(false, next.size),
      remaining * TIMING_SAFETY.clearNotifications.perTargetMs + TIMING_SAFETY.clearNotifications.reactionBufferMs,
    )
  }

  return (
    <QuestionShell instruction={`${SHAPE_LABELS[target]}の通知だけ消せ！`}>
      <div className="grid grid-cols-3 gap-4">
        {badges.map((badge) => (
          <button
            key={badge.id}
            onPointerDown={() => handleTap(badge)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 transition-opacity active:scale-90"
            style={{ opacity: cleared.has(badge.id) ? 0.15 : 1 }}
          >
            <ShapeIcon shape={badge.shape} size={32} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const ClearNotificationsQuestionModule: QuestionModule = {
  id: 'clearNotifications',
  category: 'visual',
  baseTargetTimeMs: 2200,
  generate,
  Component,
  computeMinTargetTimeMs,
}
