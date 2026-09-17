import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：
 * 「計算の答えより大きい数字の中で一番小さいものを押せ！」。
 * 計算＋数値比較の複合判断。answerより大きい候補が必ず2個以上あるように生成する。
 */
function generate() {
  const a = randInt(2, 9)
  const b = randInt(2, 9)
  const answer = a + b
  const aboveSet = new Set<number>()
  while (aboveSet.size < 2) {
    const v = answer + randInt(1, 6)
    aboveSet.add(v)
  }
  const belowSet = new Set<number>()
  while (belowSet.size < 2) {
    const v = answer - randInt(1, 6)
    if (v > 0 && v !== answer) belowSet.add(v)
  }
  const options = shuffle([...aboveSet, ...belowSet])
  const target = Math.min(...aboveSet)
  return { a, b, answer, options, target }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { a, b, options, target } = spec.data as { a: number; b: number; answer: number; options: number[]; target: number }
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
    <QuestionShell instruction={'計算の答えより大きい数字の中で\n一番小さいものを押せ！'}>
      <p className="text-3xl font-black text-white/80">
        {a} ＋ {b} ＝ ？
      </p>
      <div className="grid grid-cols-2 gap-4">
        {options.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => finish(n === target)}
            className="flex h-16 w-20 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalMathThresholdModule: FinalQuestionModule = {
  id: 'finalMathThreshold',
  tags: ['math', 'number'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
