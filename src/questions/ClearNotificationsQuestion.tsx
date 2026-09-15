import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt, shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const OTHER_COLORS = ['#3b82f6', '#22c55e', '#a855f7']

interface Badge {
  id: number
  isTarget: boolean
  hex: string
}

/** 「通知を消せ」：通知バッジを見ると全部消したくなる、というドパガキの衝動を狙う。 */
function generate() {
  const targetCount = randInt(3, 4)
  const distractorCount = randInt(2, 3)
  const badges: Badge[] = [
    ...Array.from({ length: targetCount }, (_, i) => ({ id: i, isTarget: true, hex: '#ef4444' })),
    ...Array.from({ length: distractorCount }, (_, i) => ({
      id: targetCount + i,
      isTarget: false,
      hex: OTHER_COLORS[randInt(0, OTHER_COLORS.length - 1)],
    })),
  ]
  return { badges: shuffle(badges), targetCount }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { targetCount } = data as { targetCount: number }
  return targetCount * TIMING_SAFETY.clearNotifications.perTargetMs + TIMING_SAFETY.clearNotifications.reactionBufferMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { badges, targetCount } = spec.data as { badges: Badge[]; targetCount: number }
  const [cleared, setCleared] = useState<Set<number>>(new Set())
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, clearedCount = 0) {
    if (doneRef.current) return
    doneRef.current = true
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
    if (next.size >= targetCount) finish(true, next.size)
  }

  return (
    <QuestionShell instruction="赤い通知だけ消せ！">
      <div className="grid grid-cols-3 gap-4">
        {badges.map((badge) => (
          <button
            key={badge.id}
            onPointerDown={() => handleTap(badge)}
            className="flex h-16 w-16 items-center justify-center rounded-full transition-opacity active:scale-90"
            style={{ backgroundColor: badge.hex, opacity: cleared.has(badge.id) ? 0.15 : 1 }}
          />
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
