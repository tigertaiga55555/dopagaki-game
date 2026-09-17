import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const NON_RED_COLORS = [
  { id: 'blue', hex: '#3b82f6' },
  { id: 'green', hex: '#22c55e' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'purple', hex: '#a855f7' },
] as const
const RED_HEX = '#ef4444'

interface Circle {
  id: number
  hex: string
  size: number
}

/**
 * FINAL DOPA TRIAL Q5〜Q8（2条件処理プール）：「赤以外で一番大きい丸を押せ！」。
 * 「赤を除外する」＋「その中で最大」の複合判断。赤の中にわざと一番大きい丸を混ぜ、
 * 色を見ずにサイズだけで判断すると誤答するようにする。
 */
function generate() {
  const nonRed = shuffle(NON_RED_COLORS).slice(0, 3)
  const redCount = randInt(2, 3)
  const sizes = new Set<number>()
  while (sizes.size < 3 + redCount) sizes.add(randInt(34, 88))
  const sizeList = [...sizes].sort((a, b) => b - a)
  // 赤の中に一番大きいサイズを混ぜ込み、色を無視した「サイズだけ最大」への誤答を誘発する。
  const trapSize = sizeList[0]
  const nonRedSizes = sizeList.slice(1, 4)
  const redSizes = [trapSize, ...sizeList.slice(4)]

  const circles: Circle[] = [
    ...nonRed.map((c, i) => ({ id: i, hex: c.hex, size: nonRedSizes[i] })),
    ...redSizes.map((s, i) => ({ id: 3 + i, hex: RED_HEX, size: s })),
  ]
  const target = Math.max(...nonRedSizes)
  return { circles: shuffle(circles), target }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { circles, target } = spec.data as { circles: Circle[]; target: number }
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
    <QuestionShell instruction={'赤以外で\n一番大きい丸を押せ！'}>
      <div className="grid grid-cols-3 gap-3">
        {circles.map((c) => (
          <button key={c.id} onPointerDown={() => finish(c.size === target && c.hex !== RED_HEX)} className="flex h-20 w-20 items-center justify-center active:scale-90">
            <span className="rounded-full" style={{ width: c.size, height: c.size, backgroundColor: c.hex }} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalLargestNonRedCircleModule: FinalQuestionModule = {
  id: 'finalLargestNonRedCircle',
  tags: ['color', 'visual', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
