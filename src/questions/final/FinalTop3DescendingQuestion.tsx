import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「大きい順に3つ押せ！」。
 * 6個の数字から上位3つだけを大きい順に選ぶ（全部を処理する必要はないが、
 * 「どれが上位3つか」を一目で見極める必要がある高難度の順序判断）。
 */
function generate() {
  const numbers = new Set<number>()
  while (numbers.size < 6) numbers.add(randInt(1, 99))
  const sorted = [...numbers].sort((a, b) => b - a)
  const order = sorted.slice(0, 3)
  return { numbers: shuffle([...numbers]), order }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
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
    <QuestionShell instruction="大きい順に3つ押せ！">
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

export const FinalTop3DescendingModule: FinalQuestionModule = {
  id: 'finalTop3Descending',
  tags: ['number', 'sequence'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
