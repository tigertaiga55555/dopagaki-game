import { useEffect, useRef } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

interface Item {
  id: number
  shape: ShapeId
  size: number
}

/**
 * Ver.6 Phase 1: 旧「青い丸の中で一番小さいものを押せ！」（色識別が正解条件の一部だった
 * 問題）を、指定図形の中でのサイズ比較に再設計した。「対象図形を選ぶ」＋「その中で最小」の
 * 複合判断。対象外の図形の中にわざと一番小さいサイズを混ぜ、図形を無視した
 * 「サイズだけ最小」への誤答を誘発する構成は旧実装を踏襲している。
 */
function generate() {
  const targetShape = SHAPE_IDS[randInt(0, SHAPE_IDS.length - 1)]
  const others = shuffle(SHAPE_IDS.filter((s) => s !== targetShape)).slice(0, 2)
  const targetCount = randInt(2, 3)
  const sizes = new Set<number>()
  while (sizes.size < 2 + targetCount) sizes.add(randInt(34, 88))
  const sizeList = [...sizes].sort((a, b) => a - b)
  const trapSize = sizeList[0]
  const targetSizes = sizeList.slice(1, 1 + targetCount)
  const otherSizes = [trapSize, ...sizeList.slice(1 + targetCount)]

  const items: Item[] = [
    ...others.map((s, i) => ({ id: i, shape: s, size: otherSizes[i] })),
    ...targetSizes.map((s, i) => ({ id: 2 + i, shape: targetShape, size: s })),
  ]
  const target = Math.min(...targetSizes)
  return { items: shuffle(items), targetShape, target }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items, targetShape, target } = spec.data as { items: Item[]; targetShape: ShapeId; target: number }
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
    <QuestionShell instruction={`${SHAPE_LABELS[targetShape]}の中で\n一番小さいものを押せ！`}>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => finish(it.size === target && it.shape === targetShape)}
            className="flex h-20 w-20 items-center justify-center active:scale-90"
          >
            <ShapeIcon shape={it.shape} size={it.size} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalSmallestBlueCircleModule: FinalQuestionModule = {
  id: 'finalSmallestBlueCircle',
  tags: ['visual', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
