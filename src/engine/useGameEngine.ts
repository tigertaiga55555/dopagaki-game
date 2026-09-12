import { useCallback, useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import { generateTimeline } from './timeline'
import type { GameStep, StepEffect } from '../types'

export interface EngineSnapshot {
  displayPoint: number
  maxPoint: number
  message: string
  effect?: StepEffect
  effectKey: number
  isFirstCrash: boolean
}

export interface EngineResult {
  finalPoint: number
  maxPoint: number
  isAuto: boolean
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

const initialSnapshot: EngineSnapshot = {
  displayPoint: GAME_CONFIG.startPoint,
  maxPoint: GAME_CONFIG.startPoint,
  message: '',
  effect: undefined,
  effectKey: 0,
  isFirstCrash: false,
}

/**
 * ゲーム本編のポイント推移を進行させるフック。
 * confirm() を呼ぶとその時点の表示ポイントで確定し、結果を返す。
 */
export function useGameEngine(onEnd: (result: EngineResult) => void) {
  const timelineRef = useRef<GameStep[] | undefined>(undefined)
  if (!timelineRef.current) {
    timelineRef.current = generateTimeline()
  }

  const [snapshot, setSnapshot] = useState<EngineSnapshot>(initialSnapshot)

  const stepIndexRef = useRef(0)
  const stepStartValueRef = useRef(GAME_CONFIG.startPoint)
  const stepStartTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const endedRef = useRef(false)
  const maxPointRef = useRef(GAME_CONFIG.startPoint)
  const displayPointRef = useRef(GAME_CONFIG.startPoint)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const finalize = useCallback((isAuto: boolean) => {
    if (endedRef.current) return
    endedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const rawFinal = displayPointRef.current
    const finalPoint = isAuto
      ? Math.round(rawFinal * GAME_CONFIG.autoEndBonusMultiplier)
      : Math.round(rawFinal)
    onEndRef.current({
      finalPoint: Math.max(1, finalPoint),
      maxPoint: Math.round(maxPointRef.current),
      isAuto,
    })
  }, [])

  useEffect(() => {
    const steps = timelineRef.current!

    const tick = (now: number) => {
      if (endedRef.current) return
      if (stepStartTimeRef.current === null) stepStartTimeRef.current = now

      const idx = stepIndexRef.current
      if (idx >= steps.length) {
        finalize(true)
        return
      }
      const step = steps[idx]
      const elapsed = now - stepStartTimeRef.current
      const ratio = Math.min(1, step.duration === 0 ? 1 : elapsed / step.duration)
      const eased = easeOutCubic(ratio)
      const interpolated =
        stepStartValueRef.current + (step.point - stepStartValueRef.current) * eased

      displayPointRef.current = interpolated
      maxPointRef.current = Math.max(maxPointRef.current, step.point)

      setSnapshot({
        displayPoint: interpolated,
        maxPoint: maxPointRef.current,
        message: step.message ?? '',
        effect: step.effect,
        effectKey: idx,
        isFirstCrash: Boolean(step.isFirstCrash),
      })

      if (ratio >= 1) {
        stepIndexRef.current += 1
        stepStartValueRef.current = step.point
        stepStartTimeRef.current = now
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stepStartTimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalize])

  const confirm = useCallback(() => {
    finalize(false)
  }, [finalize])

  return { snapshot, confirm }
}
