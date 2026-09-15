import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** バッジの出現枠（固定6箇所）。同時出現数の上限にもなり、DOM無限生成を防ぐ。 */
const SLOTS = [
  { x: 20, y: 20 },
  { x: 50, y: 15 },
  { x: 80, y: 20 },
  { x: 20, y: 60 },
  { x: 50, y: 65 },
  { x: 80, y: 60 },
]

const OTHER_HEX = ['#3b82f6', '#22c55e']

interface Badge {
  id: number
  slotIndex: number
  isTarget: boolean
  hex: string
}

/** 「赤だけ消せ！」：通知バッジが次々出現する。赤だけタップして規定数消せば成功、赤以外は即MISS。 */
function generate() {
  const targetRedCount = randInt(4, 5)
  const spawnIntervalMs = randInt(200, 350)
  const lifespanMs = randInt(950, 1250)
  return { targetRedCount, spawnIntervalMs, lifespanMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { targetRedCount } = data as { targetRedCount: number }
  return targetRedCount * TIMING_SAFETY.notifRush.perRedMs + TIMING_SAFETY.notifRush.reactionBufferMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { targetRedCount, spawnIntervalMs, lifespanMs } = spec.data as {
    targetRedCount: number
    spawnIntervalMs: number
    lifespanMs: number
  }
  const [badges, setBadges] = useState<Badge[]>([])
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const clearedRedRef = useRef(0)
  const badgeIdRef = useRef(0)
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const despawnTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function removeBadge(id: number) {
      const t = despawnTimersRef.current.get(id)
      if (t) {
        clearTimeout(t)
        despawnTimersRef.current.delete(id)
      }
      setBadges((prev) => prev.filter((b) => b.id !== id))
    }

    spawnTimerRef.current = setInterval(() => {
      if (doneRef.current) return
      setBadges((prev) => {
        const occupied = new Set(prev.map((b) => b.slotIndex))
        const freeSlots = SLOTS.map((_, i) => i).filter((i) => !occupied.has(i))
        if (freeSlots.length === 0) return prev
        const slotIndex = freeSlots[randInt(0, freeSlots.length - 1)]
        const isTarget = Math.random() < 0.55
        const id = badgeIdRef.current++
        const badge: Badge = { id, slotIndex, isTarget, hex: isTarget ? '#ef4444' : OTHER_HEX[randInt(0, OTHER_HEX.length - 1)] }
        if (isTarget) sfx.notifSpawn()
        despawnTimersRef.current.set(
          id,
          setTimeout(() => removeBadge(id), lifespanMs),
        )
        return [...prev, badge]
      })
    }, spawnIntervalMs)

    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      despawnTimersRef.current.forEach((t) => clearTimeout(t))
      despawnTimersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    despawnTimersRef.current.forEach((t) => clearTimeout(t))
    despawnTimersRef.current.clear()
    onResult({
      correct,
      reactionMs: performance.now() - startRef.current,
      meta: { targetsCleared: clearedRedRef.current, targetsTotal: targetRedCount },
    })
  }

  function handleTap(badge: Badge) {
    if (doneRef.current) return
    if (!badge.isTarget) {
      finish(false)
      return
    }
    const t = despawnTimersRef.current.get(badge.id)
    if (t) {
      clearTimeout(t)
      despawnTimersRef.current.delete(badge.id)
    }
    setBadges((prev) => prev.filter((b) => b.id !== badge.id))
    clearedRedRef.current += 1
    sfx.notifPop()
    if (clearedRedRef.current >= targetRedCount) finish(true)
  }

  return (
    <QuestionShell sub={`赤 ${clearedRedRef.current}/${targetRedCount}`} instruction="赤だけ消せ！">
      <div className="relative h-64 w-full max-w-xs">
        {badges.map((badge) => (
          <button
            key={badge.id}
            onPointerDown={() => handleTap(badge)}
            style={{ left: `${SLOTS[badge.slotIndex].x}%`, top: `${SLOTS[badge.slotIndex].y}%`, backgroundColor: badge.hex }}
            className="anim-pop absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full active:scale-90"
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const NotifRushQuestionModule: QuestionModule = {
  id: 'notifRush',
  category: 'sorting',
  baseTargetTimeMs: 2800,
  generate,
  Component,
  computeMinTargetTimeMs,
}
