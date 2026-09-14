import { useEffect, useRef } from 'react'
import { pick, shuffle } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const COLORS = [
  { id: 'red', label: '赤', hex: '#ef4444' },
  { id: 'blue', label: '青', hex: '#3b82f6' },
  { id: 'green', label: '緑', hex: '#22c55e' },
  { id: 'yellow', label: '黄', hex: '#eab308' },
]

function generate() {
  return { target: pick(COLORS), options: shuffle(COLORS) }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { target, options } = spec.data as { target: (typeof COLORS)[0]; options: typeof COLORS }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false, spec.targetTimeMs), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, reactionMs: number) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs })
  }

  return (
    <QuestionShell instruction={`${target.label}を押せ！`}>
      <div className="grid grid-cols-2 gap-5">
        {options.map((c) => (
          <button
            key={c.id}
            onPointerDown={() => finish(c.id === target.id, performance.now() - startRef.current)}
            className="h-20 w-20 rounded-full active:scale-90"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const ColorQuestionModule: QuestionModule = {
  id: 'color',
  baseTargetTimeMs: 1400,
  generate,
  Component,
}
