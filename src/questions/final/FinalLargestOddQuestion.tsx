import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const EVEN_DIGITS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
const ODD_DIGITS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]

function pickDistinct(pool: number[], count: number): number[] {
  return shuffle(pool).slice(0, count)
}

/**
 * FINAL DOPA TRIAL Q5〜Q8（2条件処理プール）：「一番大きい奇数を押せ！」。
 * FinalSmallestEvenQuestionの対になる問題（奇数×最大）。
 */
function generate() {
  const odds = pickDistinct(ODD_DIGITS, 3)
  const evens = pickDistinct(EVEN_DIGITS, randInt(2, 3))
  const numbers = shuffle([...odds, ...evens])
  const target = Math.max(...odds)
  return { numbers, target }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
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
    <QuestionShell instruction="一番大きい奇数を押せ！">
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

export const FinalLargestOddModule: FinalQuestionModule = {
  id: 'finalLargestOdd',
  tags: ['number', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
