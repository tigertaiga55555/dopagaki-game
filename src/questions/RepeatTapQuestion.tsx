import { useEffect, useRef, useState } from 'react'
import { randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  return { required: randInt(3, 7) }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { required } = spec.data as { required: number }
  const [count, setCount] = useState(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false, 0), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, extraTaps: number) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current, meta: { extraTaps } })
  }

  function handleTap() {
    if (doneRef.current) return
    const next = count + 1
    if (next > required) {
      finish(false, next - required)
      return
    }
    setCount(next)
    if (next === required) finish(true, 0)
  }

  return (
    <QuestionShell instruction={`${required}回押せ！`}>
      <button
        onPointerDown={handleTap}
        className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-fuchsia-500 to-purple-600 text-3xl font-black text-white active:scale-95"
      >
        {count}
      </button>
    </QuestionShell>
  )
}

export const RepeatTapQuestionModule: QuestionModule = {
  id: 'repeatTap',
  baseTargetTimeMs: 1800,
  generate,
  Component,
}
