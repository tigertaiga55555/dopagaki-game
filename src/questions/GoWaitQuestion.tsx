import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../components/ShapeIcon'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick, pickExcluding, randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import { useQuestionStartRef } from './useQuestionStartRef'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * Ver.6 Phase 1: 旧「緑で押せ！」（色識別が正解条件だった信号ゲーム）を、
 * 色覚特性に依存しない形へ再設計。非対象図形を2〜5回ランダムに切替えてから、
 * 必ず対象図形（例：○）で終わるシーケンスに構造化する。「初手から対象図形」が
 * 型として発生し得ない点、押す/押さないの判定ロジックは旧実装を踏襲している。
 */
interface Step {
  shape: ShapeId
  durationMs: number
}

function generate() {
  const target = pick(SHAPE_IDS)
  const stepCount = randInt(2, 5)
  const steps: Step[] = []
  let prev: ShapeId | undefined
  for (let i = 0; i < stepCount; i++) {
    const shape = pickExcluding(
      SHAPE_IDS.filter((s) => s !== target),
      prev,
    )
    prev = shape
    steps.push({ shape, durationMs: randInt(260, 420) })
  }
  const waitMs = steps.reduce((sum, s) => sum + s.durationMs, 0)
  return { target, steps, waitMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { waitMs } = data as { waitMs: number }
  return waitMs + TIMING_SAFETY.goWait.minReactionWindowMs + TIMING_SAFETY.goWait.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { target, steps, waitMs } = spec.data as { target: ShapeId; steps: Step[]; waitMs: number }
  const [stepIndex, setStepIndex] = useState(0)
  const [isGo, setIsGo] = useState(false)
  const startRef = useQuestionStartRef()
  const goAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    let cumulative = 0
    steps.forEach((step, i) => {
      if (i > 0) {
        const t = setTimeout(() => setStepIndex(i), cumulative)
        timersRef.current.push(t)
      }
      cumulative += step.durationMs
    })
    const goTimer = setTimeout(() => {
      goAtRef.current = performance.now()
      setIsGo(true)
      sfx.go()
    }, waitMs)
    timersRef.current.push(goTimer)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    timersRef.current.push(failTimer)
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, earlyPress = false) {
    if (doneRef.current) return
    doneRef.current = true
    timersRef.current.forEach(clearTimeout)
    if (!correct) {
      onResult({ correct: false, reactionMs: performance.now() - startRef.current, meta: earlyPress ? { earlyPress: true } : undefined })
      return
    }
    const goAt = goAtRef.current ?? performance.now()
    const reactionMs = performance.now() - goAt
    const ratioWindowMs = spec.targetTimeMs - waitMs
    onResult({ correct: true, reactionMs, ratioWindowMs })
  }

  function handlePress() {
    if (doneRef.current) return
    if (!isGo) {
      finish(false, true)
      return
    }
    finish(true)
  }

  const currentShape = isGo ? target : steps[stepIndex].shape

  return (
    <QuestionShell instruction={`${SHAPE_LABELS[target]}が出たら押せ！`}>
      <button
        onPointerDown={handlePress}
        className={`flex h-32 w-32 items-center justify-center rounded-full border-4 bg-white/5 transition-colors duration-75 active:scale-95 ${
          isGo ? 'signal-pulse signal-green-glow border-emerald-200' : 'border-white/20'
        }`}
      >
        <ShapeIcon shape={currentShape} size={64} />
      </button>
    </QuestionShell>
  )
}

export const GoWaitQuestionModule: QuestionModule = {
  id: 'goWait',
  category: 'inhibition',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
