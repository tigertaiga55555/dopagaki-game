import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt } from '../engine/random'
import { colorSymbol, COLOR_SYMBOL_STYLE } from './colorSymbols'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const COLORS = [
  { id: 'red', hex: '#ef4444' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'green', hex: '#22c55e' },
  { id: 'yellow', hex: '#eab308' },
]

function generate() {
  const main = COLORS[randInt(0, COLORS.length - 1)]
  const odd = pickExcluding(COLORS, main)
  const oddIndex = randInt(0, 3)
  const colors = [0, 1, 2, 3].map((i) => (i === oddIndex ? odd : main))
  return { colors, oddIndex }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { colors, oddIndex } = spec.data as { colors: (typeof COLORS)[0][]; oddIndex: number }
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
    <QuestionShell instruction="周りと違う色を押せ！">
      <div className="grid grid-cols-2 gap-4">
        {colors.map((c, i) => (
          <button
            key={i}
            onPointerDown={() => finish(i === oddIndex)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl active:scale-90"
            style={{ backgroundColor: c.hex }}
          >
            <span style={COLOR_SYMBOL_STYLE}>{colorSymbol(c.id)}</span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const DifferentOneQuestionModule: QuestionModule = {
  id: 'differentOne',
  category: 'visual',
  baseTargetTimeMs: 1800,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.reactionMinMs.differentOne,
}
