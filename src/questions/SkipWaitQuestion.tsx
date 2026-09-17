import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** 「SKIP待ち」：広告風のカウントダウンUIで「SKIPが出るまで待てない」を狙う。 */
function generate() {
  return { waitMs: randInt(800, 1500) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { waitMs } = data as { waitMs: number }
  return waitMs + TIMING_SAFETY.skipWait.minReactionWindowMs + TIMING_SAFETY.skipWait.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { waitMs } = spec.data as { waitMs: number }
  const [countLabel, setCountLabel] = useState('2')
  const [isSkip, setIsSkip] = useState(false)
  const startRef = useRef(performance.now())
  const skipAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const halfTimer = setTimeout(() => setCountLabel('1'), waitMs * 0.5)
    const skipTimer = setTimeout(() => {
      skipAtRef.current = performance.now()
      setIsSkip(true)
      sfx.skip()
    }, waitMs)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(halfTimer)
      clearTimeout(skipTimer)
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
    const skipAt = skipAtRef.current ?? performance.now()
    const reactionMs = performance.now() - skipAt
    const ratioWindowMs = spec.targetTimeMs - waitMs
    onResult({ correct: true, reactionMs, ratioWindowMs })
  }

  function handlePress() {
    if (doneRef.current) return
    if (!isSkip) {
      finish(false, true)
      return
    }
    sfx.skipHit()
    finish(true)
  }

  return (
    <QuestionShell instruction="SKIPが出たら押せ！">
      <button
        onPointerDown={handlePress}
        className="flex h-24 w-full max-w-xs items-center justify-center rounded-xl border border-white/20 bg-black/40 text-lg font-bold text-white/80 active:scale-95"
      >
        {isSkip ? <span className="text-2xl font-black tracking-widest text-amber-300">SKIP ▶</span> : <span>SKIPまで {countLabel}</span>}
      </button>
    </QuestionShell>
  )
}

export const SkipWaitQuestionModule: QuestionModule = {
  id: 'skipWait',
  category: 'inhibition',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
