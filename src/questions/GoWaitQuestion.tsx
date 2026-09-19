import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { colorSymbol, COLOR_SYMBOL_STYLE } from './colorSymbols'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * Ver.4.6: 「緑で押せ！」（信号ゲーム）を全面再設計。
 * これまでは「灰色→緑」の一発切替だったため、見た瞬間すでに緑に見えてしまい
 * 「待つ・反応する」ゲームとして成立しないケースがあった。
 * 今回は非緑色（青/赤/黄）を2〜5回ランダムに高速切替してから、必ず緑で終わる
 * シーケンスに構造化することで、「初手緑」を型として発生し得ないようにした。
 */
const NON_GREEN_COLORS = [
  { id: 'blue', hex: '#3b82f6' },
  { id: 'red', hex: '#ef4444' },
  { id: 'yellow', hex: '#eab308' },
] as const
const GREEN_HEX = '#22c55e'
const GREEN_ID = 'green'

interface Step {
  id: string
  hex: string
  durationMs: number
}

function generate() {
  const stepCount = randInt(2, 5)
  const steps: Step[] = []
  let prev: (typeof NON_GREEN_COLORS)[number] | undefined
  for (let i = 0; i < stepCount; i++) {
    const color = pickExcluding(NON_GREEN_COLORS, prev)
    prev = color
    steps.push({ id: color.id, hex: color.hex, durationMs: randInt(260, 420) })
  }
  const waitMs = steps.reduce((sum, s) => sum + s.durationMs, 0)
  return { steps, waitMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { waitMs } = data as { waitMs: number }
  return waitMs + TIMING_SAFETY.goWait.minReactionWindowMs + TIMING_SAFETY.goWait.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { steps, waitMs } = spec.data as { steps: Step[]; waitMs: number }
  const [stepIndex, setStepIndex] = useState(0)
  const [isGreen, setIsGreen] = useState(false)
  const startRef = useRef(performance.now())
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
      setIsGreen(true)
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
    if (!isGreen) {
      finish(false, true)
      return
    }
    finish(true)
  }

  const currentHex = isGreen ? GREEN_HEX : steps[stepIndex].hex
  const currentColorId = isGreen ? GREEN_ID : steps[stepIndex].id

  return (
    <QuestionShell instruction={`緑（${colorSymbol(GREEN_ID)}）で押せ！`}>
      <button
        onPointerDown={handlePress}
        className={`flex h-32 w-32 items-center justify-center rounded-full border-4 text-4xl transition-colors duration-75 active:scale-95 ${
          isGreen ? 'signal-pulse signal-green-glow border-emerald-200' : 'border-white/20'
        }`}
        style={{ backgroundColor: currentHex }}
      >
        <span style={COLOR_SYMBOL_STYLE}>{colorSymbol(currentColorId)}</span>
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
