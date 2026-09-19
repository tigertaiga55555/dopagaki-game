import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt, shuffle } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
// Ver.5.1修正: 偶数判定は原則 n % 2 === 0 とする（0は数学上必ず偶数）。
// ハードコードの配列も、この判定式から導出することで判定ロジックとのズレを構造的に防ぐ。
const ODD_DIGITS = DIGITS.filter((n) => n % 2 !== 0)
const EVEN_DIGITS = DIGITS.filter((n) => n % 2 === 0)

function pickDistinct(pool: number[], count: number): number[] {
  const shuffled = shuffle(pool)
  return shuffled.slice(0, count)
}

/**
 * Ver.5.0で追加。「奇数を押せ！」：既存の「偶数を押せ！」と完全に対になる問題。
 * 4つの一桁数字のうち、必ず1つだけ奇数になるよう生成する（偶数3つ+奇数1つを
 * 別々にランダム抽選してから混ぜる）。難しい計算は一切なく、瞬時に判断できる認知問題。
 * ODD_DIGITS/EVEN_DIGITSが完全に排反なため、選択肢内に正解となる奇数が複数存在する
 * ことは構造的に起こり得ない。
 */
function generate() {
  const evens = pickDistinct(EVEN_DIGITS, 3)
  const odd = ODD_DIGITS[randInt(0, ODD_DIGITS.length - 1)]
  const numbers = shuffle([...evens, odd])
  return { numbers, target: odd }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.oddNumber.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { numbers } = spec.data as { numbers: number[] }
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
    <QuestionShell instruction="奇数を押せ！">
      <div className="grid grid-cols-2 gap-4">
        {numbers.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => finish(n % 2 !== 0)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const OddNumberQuestionModule: QuestionModule = {
  id: 'oddNumber',
  category: 'reaction',
  baseTargetTimeMs: 1700,
  generate,
  Component,
  computeMinTargetTimeMs,
}
