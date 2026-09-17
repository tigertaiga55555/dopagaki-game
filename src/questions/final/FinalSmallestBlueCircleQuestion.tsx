import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const OTHER_COLORS = [
  { id: 'red', hex: '#ef4444' },
  { id: 'green', hex: '#22c55e' },
  { id: 'yellow', hex: '#eab308' },
] as const
const BLUE_HEX = '#3b82f6'

interface Circle {
  id: number
  hex: string
  size: number
}

/**
 * FINAL DOPA TRIAL Q5〜Q8（2条件処理プール）：「青い丸の中で一番小さいものを押せ！」。
 * 「青を選ぶ」＋「その中で最小」の複合判断。青以外の中に一番小さいサイズを混ぜ、
 * 色を無視した「サイズだけ最小」への誤答を誘発する。
 */
function generate() {
  const others = shuffle(OTHER_COLORS).slice(0, 2)
  const blueCount = randInt(2, 3)
  const sizes = new Set<number>()
  while (sizes.size < 2 + blueCount) sizes.add(randInt(34, 88))
  const sizeList = [...sizes].sort((a, b) => a - b)
  const trapSize = sizeList[0]
  const blueSizes = sizeList.slice(1, 1 + blueCount)
  const otherSizes = [trapSize, ...sizeList.slice(1 + blueCount)]

  const circles: Circle[] = [
    ...others.map((c, i) => ({ id: i, hex: c.hex, size: otherSizes[i] })),
    ...blueSizes.map((s, i) => ({ id: 2 + i, hex: BLUE_HEX, size: s })),
  ]
  const target = Math.min(...blueSizes)
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
    <QuestionShell instruction={'青い丸の中で\n一番小さいものを押せ！'}>
      <div className="grid grid-cols-3 gap-3">
        {circles.map((c) => (
          <button key={c.id} onPointerDown={() => finish(c.size === target && c.hex === BLUE_HEX)} className="flex h-20 w-20 items-center justify-center active:scale-90">
            <span className="rounded-full" style={{ width: c.size, height: c.size, backgroundColor: c.hex }} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalSmallestBlueCircleModule: FinalQuestionModule = {
  id: 'finalSmallestBlueCircle',
  tags: ['color', 'visual', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
