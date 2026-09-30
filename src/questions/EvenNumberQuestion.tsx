import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt, shuffle } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

const ODD_DIGITS = [1, 3, 5, 7, 9]
const EVEN_DIGITS = [0, 2, 4, 6, 8]

function pickDistinct(pool: number[], count: number): number[] {
  const shuffled = shuffle(pool)
  return shuffled.slice(0, count)
}

/**
 * Ver.4.9で追加。「偶数を押せ！」：4つの一桁数字のうち、必ず1つだけ偶数になるよう
 * 生成する（奇数3つ+偶数1つを別々にランダム抽選してから混ぜる）。難しい計算は
 * 一切なく、瞬時に判断できる認知問題として使う。
 */
function generate() {
  const odds = pickDistinct(ODD_DIGITS, 3)
  const even = EVEN_DIGITS[randInt(0, EVEN_DIGITS.length - 1)]
  const numbers = shuffle([...odds, even])
  return { numbers, target: even }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.evenNumber.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { numbers, target } = spec.data as { numbers: number[]; target: number }
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
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
    <QuestionShell instruction="偶数を押せ！">
      <div className="grid grid-cols-2 gap-4">
        {numbers.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => finish(n === target)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const EvenNumberQuestionModule: QuestionModule = {
  id: 'evenNumber',
  category: 'reaction',
  baseTargetTimeMs: 1700,
  generate,
  Component,
  computeMinTargetTimeMs,
}
