import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const SHAPES = ['⚪', '🔷', '⭐', '🟢', '🟣', '🟡']

/** 「変わったやつを押せ」：新しい刺激が出た瞬間そこへ視線が飛ぶ、という反応の速さを試す。 */
function generate() {
  const baseIcon = SHAPES[randInt(0, SHAPES.length - 1)]
  const changedIcon = pickExcluding(SHAPES, baseIcon)
  const changeIndex = randInt(0, 3)
  const preDelayMs = randInt(300, 600)
  return { baseIcon, changedIcon, changeIndex, preDelayMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { preDelayMs } = data as { preDelayMs: number }
  return preDelayMs + TIMING_SAFETY.spotChange.minReactionWindowMs + TIMING_SAFETY.spotChange.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { baseIcon, changedIcon, changeIndex, preDelayMs } = spec.data as {
    baseIcon: string
    changedIcon: string
    changeIndex: number
    preDelayMs: number
  }
  const [changed, setChanged] = useState(false)
  const startRef = useRef(performance.now())
  const changedAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const changeTimer = setTimeout(() => {
      changedAtRef.current = performance.now()
      setChanged(true)
    }, preDelayMs)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(changeTimer)
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
    const changedAt = changedAtRef.current ?? performance.now()
    const reactionMs = performance.now() - changedAt
    const ratioWindowMs = spec.targetTimeMs - preDelayMs
    onResult({ correct: true, reactionMs, ratioWindowMs })
  }

  function handleTap(index: number) {
    if (doneRef.current) return
    if (!changed) {
      finish(false, true)
      return
    }
    finish(index === changeIndex)
  }

  return (
    <QuestionShell instruction={changed ? '変わった絵を押せ！' : '絵が変わったら押せ！'}>
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(i)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-4xl active:scale-90"
          >
            {changed && i === changeIndex ? changedIcon : baseIcon}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const SpotChangeQuestionModule: QuestionModule = {
  id: 'spotChange',
  category: 'visual',
  baseTargetTimeMs: 1400,
  generate,
  Component,
  computeMinTargetTimeMs,
}
