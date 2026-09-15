import { useEffect, useRef } from 'react'
import { randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  return { waitMs: randInt(800, 1200) }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { waitMs } = spec.data as { waitMs: number }
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(true, false), waitMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(success: boolean, touched: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({
      correct: success,
      reactionMs: 0,
      tierOverride: success ? 'PERFECT' : 'MISS',
      meta: { forbiddenTouch: touched },
    })
  }

  return (
    <div onPointerDown={() => finish(false, true)} className="h-full w-full touch-none select-none">
      <QuestionShell instruction="押すな！">
        <div className="h-20 w-20 rounded-full border-4 border-red-400/60" />
      </QuestionShell>
    </div>
  )
}

export const NoPressQuestionModule: QuestionModule = {
  id: 'noPress',
  category: 'inhibition',
  baseTargetTimeMs: 1000,
  generate,
  Component,
  // Componentは自前でdata.waitMsのタイマーを持つため、speedMultiplierの影響を受けない。
  // ここではtargetTimeMs（判定比率などに使われる値）がwaitMsを下回らないようにしておく。
  computeMinTargetTimeMs: (data) => (data as { waitMs: number }).waitMs,
}
