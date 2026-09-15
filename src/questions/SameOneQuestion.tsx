import { useEffect, useRef } from 'react'
import { shuffle } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const ICON_POOL = ['⭐', '🎈', '🍎', '🚗', '🎵', '⚡', '🌙', '🔥']

function generate() {
  const picked = shuffle(ICON_POOL).slice(0, 3)
  const [dup, u1, u2] = picked
  const items = shuffle([dup, dup, u1, u2])
  return { items, dupValue: dup }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { items, dupValue } = spec.data as { items: string[]; dupValue: string }
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
    <QuestionShell instruction="同じもの！">
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => (
          <button
            key={i}
            onPointerDown={() => finish(item === dupValue)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-4xl active:scale-90"
          >
            {item}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const SameOneQuestionModule: QuestionModule = {
  id: 'sameOne',
  category: 'visual',
  baseTargetTimeMs: 2000,
  generate,
  Component,
}
