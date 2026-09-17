import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

function pickDistinctEven(count: number): number[] {
  const pool: number[] = []
  for (let n = 2; n <= 28; n += 2) pool.push(n)
  return shuffle(pool).slice(0, count)
}

function pickDistinctOdd(count: number): number[] {
  const pool: number[] = []
  for (let n = 1; n <= 29; n += 2) pool.push(n)
  return shuffle(pool).slice(0, count)
}

/**
 * FINAL DOPA TRIAL Q5〜Q8（2条件処理プール）：「偶数だけ小さい順に全て押せ！」。
 * 「偶数を選ぶ」＋「小さい順という順序処理」の2条件。奇数を押す、または順序を間違えると即MISS。
 */
function generate() {
  const evens = pickDistinctEven(3)
  const odds = pickDistinctOdd(randInt(2, 3))
  const numbers = shuffle([...evens, ...odds])
  const order = [...evens].sort((a, b) => a - b)
  return { numbers, order }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { numbers, order } = spec.data as { numbers: number[]; order: number[] }
  const [clearedCount, setClearedCount] = useState(0)
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handleTap(n: number) {
    if (guardRef.current!.isResolved) return
    const expected = order[clearedCount]
    if (n !== expected) {
      finish(false)
      return
    }
    const next = clearedCount + 1
    setClearedCount(next)
    if (next >= order.length) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell instruction={'偶数だけ\n小さい順に全て押せ！'}>
      <div className="grid grid-cols-3 gap-3">
        {numbers.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(n)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalAscendingEvensModule: FinalQuestionModule = {
  id: 'finalAscendingEvens',
  tags: ['number', 'sequence', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
