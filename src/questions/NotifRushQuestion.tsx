import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../components/ShapeIcon'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import { useQuestionStartRef } from './useQuestionStartRef'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * バッジの出現枠（固定8箇所）。以前は6箇所だったが、Ver.5.0の重大バグ修正で「必須の対象は
 * 自動despawnさせない」方式に変更したため、必須対象（最大5個）が同時に未タップのまま残っても
 * ノイズ用の空き枠を確保できるよう2枠増やした。DOM無限生成を防ぐ上限の役割も兼ねる。
 */
const SLOTS = [
  { x: 15, y: 20 },
  { x: 38, y: 20 },
  { x: 62, y: 20 },
  { x: 85, y: 20 },
  { x: 15, y: 62 },
  { x: 38, y: 62 },
  { x: 62, y: 62 },
  { x: 85, y: 62 },
]

interface Badge {
  id: number
  slotIndex: number
  isTarget: boolean
  shape: ShapeId
}

/**
 * Ver.6 Phase 1: 旧「赤だけ消せ！」（色識別が正解条件だった問題）を、対象図形の
 * 通知だけを消す課題に再設計した。スポーンタイミング保証（Ver.5.0の重大バグ修正：
 * 必須対象の出現タイミングを開始時に先に全て確定し、枠不足時はノイズを強制退場させる）
 * はロジックを一切変更せず維持している。
 */
function generate() {
  const target = SHAPE_IDS[randInt(0, SHAPE_IDS.length - 1)]
  const targetRedCount = randInt(4, 5)
  const spawnIntervalMs = randInt(200, 350)
  const lifespanMs = randInt(950, 1250)
  return { target, targetRedCount, spawnIntervalMs, lifespanMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { targetRedCount } = data as { targetRedCount: number }
  return targetRedCount * TIMING_SAFETY.notifRush.perRedMs + TIMING_SAFETY.notifRush.reactionBufferMs
}

/**
 * 必須の対象targetRedCount個の出現タイミング（ms、問題開始からの相対時刻）を確定する。
 * [0, timeoutMs − reactionBufferMs] をtargetRedCount等分し、各区間内の1点をランダムに選ぶ
 * ことで「前半〜中盤にも適度に分散」かつ「最後の対象は締切以下」を同時に満たす。
 */
function buildRequiredRedDelays(targetRedCount: number, timeoutMs: number): number[] {
  const lastRedDeadlineMs = Math.max(0, timeoutMs - TIMING_SAFETY.notifRush.reactionBufferMs)
  const delays: number[] = []
  for (let i = 0; i < targetRedCount; i++) {
    const segStart = Math.round((lastRedDeadlineMs * i) / targetRedCount)
    const segEnd = Math.round((lastRedDeadlineMs * (i + 1)) / targetRedCount)
    delays.push(randInt(segStart, Math.max(segStart, segEnd)))
  }
  delays.sort((a, b) => a - b)
  if (delays.length > 0) {
    delays[delays.length - 1] = Math.min(delays[delays.length - 1], lastRedDeadlineMs)
  }
  return delays
}

function buildNoiseDelays(spawnIntervalMs: number, timeoutMs: number): number[] {
  const noiseIntervalMs = Math.round(spawnIntervalMs / 0.45)
  const delays: number[] = []
  let cursor = randInt(Math.round(noiseIntervalMs * 0.5), noiseIntervalMs)
  while (cursor < timeoutMs - 150) {
    delays.push(cursor)
    cursor += randInt(Math.round(noiseIntervalMs * 0.7), Math.round(noiseIntervalMs * 1.3))
  }
  return delays
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { target, targetRedCount, spawnIntervalMs, lifespanMs } = spec.data as {
    target: ShapeId
    targetRedCount: number
    spawnIntervalMs: number
    lifespanMs: number
  }
  const [badges, setBadges] = useState<Badge[]>([])
  const startRef = useQuestionStartRef()
  const doneRef = useRef(false)
  const clearedRedRef = useRef(0)
  const badgeIdRef = useRef(0)
  const spawnTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const despawnTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotOccupantsRef = useRef<Map<number, { id: number; isTarget: boolean }>>(new Map())

  useEffect(() => {
    function removeBadge(id: number) {
      const t = despawnTimersRef.current.get(id)
      if (t) {
        clearTimeout(t)
        despawnTimersRef.current.delete(id)
      }
      for (const [slot, occ] of slotOccupantsRef.current) {
        if (occ.id === id) slotOccupantsRef.current.delete(slot)
      }
      setBadges((prev) => prev.filter((b) => b.id !== id))
    }

    function spawnBadge(isTarget: boolean) {
      if (doneRef.current) return
      const occupied = new Set(slotOccupantsRef.current.keys())
      let freeSlots = SLOTS.map((_, i) => i).filter((i) => !occupied.has(i))
      if (freeSlots.length === 0) {
        if (!isTarget) return
        let evictSlot: number | null = null
        for (const [slot, occ] of slotOccupantsRef.current) {
          if (!occ.isTarget) {
            evictSlot = slot
            break
          }
        }
        if (evictSlot === null) return
        removeBadge(slotOccupantsRef.current.get(evictSlot)!.id)
        freeSlots = [evictSlot]
      }
      const slotIndex = freeSlots[randInt(0, freeSlots.length - 1)]
      const id = badgeIdRef.current++
      const shape = isTarget ? target : pickExcluding(SHAPE_IDS, target)
      slotOccupantsRef.current.set(slotIndex, { id, isTarget })
      if (isTarget) sfx.notifSpawn()
      setBadges((prev) => [...prev, { id, slotIndex, isTarget, shape }])
      if (!isTarget) {
        despawnTimersRef.current.set(
          id,
          setTimeout(() => removeBadge(id), lifespanMs),
        )
      }
    }

    buildRequiredRedDelays(targetRedCount, spec.targetTimeMs).forEach((delay) => {
      spawnTimersRef.current.push(setTimeout(() => spawnBadge(true), delay))
    })
    buildNoiseDelays(spawnIntervalMs, spec.targetTimeMs).forEach((delay) => {
      spawnTimersRef.current.push(setTimeout(() => spawnBadge(false), delay))
    })

    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)

    return () => {
      spawnTimersRef.current.forEach(clearTimeout)
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      despawnTimersRef.current.forEach((t) => clearTimeout(t))
      despawnTimersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    spawnTimersRef.current.forEach(clearTimeout)
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
    for (const [slot, occ] of slotOccupantsRef.current) {
      if (occ.id === badge.id) slotOccupantsRef.current.delete(slot)
    }
    setBadges((prev) => prev.filter((b) => b.id !== badge.id))
    clearedRedRef.current += 1
    sfx.notifPop()
    if (clearedRedRef.current >= targetRedCount) {
      finish(true)
    }
  }

  return (
    <QuestionShell sub={`${clearedRedRef.current}/${targetRedCount}`} instruction={`${SHAPE_LABELS[target]}だけ消せ！`}>
      <div className="relative h-64 w-full max-w-xs">
        {badges.map((badge) => (
          <button
            key={badge.id}
            onPointerDown={() => handleTap(badge)}
            style={{ left: `${SLOTS[badge.slotIndex].x}%`, top: `${SLOTS[badge.slotIndex].y}%` }}
            className="anim-pop absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 active:scale-90"
          >
            <ShapeIcon shape={badge.shape} size={30} />
          </button>
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
