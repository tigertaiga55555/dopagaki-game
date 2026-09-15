import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** 「GOまで押すな」：早く押したいのに待たないといけない、というドパガキの衝動そのもの。 */
function generate() {
  return { waitMs: randInt(500, 1300) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { waitMs } = data as { waitMs: number }
  return waitMs + TIMING_SAFETY.goWait.minReactionWindowMs + TIMING_SAFETY.goWait.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { waitMs } = spec.data as { waitMs: number }
  const [isGo, setIsGo] = useState(false)
  const startRef = useRef(performance.now())
  const goAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const goTimer = setTimeout(() => {
      goAtRef.current = performance.now()
      setIsGo(true)
      sfx.go()
    }, waitMs)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(goTimer)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, earlyPress = false) {
    if (doneRef.current) return
    doneRef.current = true
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

  return (
    <QuestionShell instruction={isGo ? 'GO!' : 'READY...'}>
      <button
        onPointerDown={handlePress}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-2xl font-black text-white active:scale-95 ${
          isGo ? 'bg-gradient-to-b from-emerald-400 to-green-600' : 'bg-white/10'
        }`}
      >
        {isGo ? 'GO' : '…'}
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
