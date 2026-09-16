import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick, pickExcluding, randInt, shuffle } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const CATEGORIES: string[][] = [
  ['🍎', '🍌', '🍇', '🍊', '🍓'],
  ['🚗', '🚌', '🚲', '✈️', '🚢'],
  ['🐶', '🐱', '🐰', '🐻', '🐼'],
  ['⚽', '🏀', '🎾', '🏐', '🏈'],
]

function generate() {
  const mainCategory = pick(CATEGORIES)
  const oddCategory = pickExcluding(CATEGORIES, mainCategory)
  const mainItems = shuffle(mainCategory).slice(0, 3)
  const oddItem = pick(oddCategory)
  const items = shuffle([...mainItems, oddItem])
  const oddIndex = items.indexOf(oddItem)
  return { items, oddIndex: oddIndex === -1 ? randInt(0, 3) : oddIndex }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { items, oddIndex } = spec.data as { items: string[]; oddIndex: number }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell instruction="仲間外れを押せ！">
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => (
          <button
            key={i}
            onPointerDown={() => finish(i === oddIndex)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-4xl active:scale-90"
          >
            {item}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const OddOneOutQuestionModule: QuestionModule = {
  id: 'oddOneOut',
  category: 'visual',
  baseTargetTimeMs: 2200,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.reactionMinMs.oddOneOut,
}
