import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q1〜Q4（反転・一段難化プール）：「2番目に小さい数字を押せ！」。
 * FinalSecondLargestQuestionの逆方向版。
 */
function generate() {
  const numbers = new Set<number>()
  while (numbers.size < 5) numbers.add(randInt(1, 99))
  const sorted = [...numbers].sort((a, b) => a - b)
  return { numbers: shuffle([...numbers]), target: sorted[1] }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { numbers, target } = spec.data as { numbers: number[]; target: number }
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell instruction="2番目に小さい数字を押せ！">
      <div className="grid grid-cols-3 gap-3">
        {numbers.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => finish(n === target)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalSecondSmallestModule: FinalQuestionModule = {
  id: 'finalSecondSmallest',
  tags: ['number', 'reverse'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
