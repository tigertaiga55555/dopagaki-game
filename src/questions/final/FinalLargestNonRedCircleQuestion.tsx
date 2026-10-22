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
 * Ver.6 Phase 1: 旧「赤以外で一番大きい丸を押せ！」（色識別が正解条件の一部だった問題）を、
 * 指定図形を除外した上でのサイズ比較に再設計した。「除外図形を見分ける」＋「その中で最大」の
 * 複合判断。除外図形の中にわざと一番大きいサイズを混ぜ、図形を無視した「サイズだけ最大」への
 * 誤答を誘発する構成は旧実装を踏襲している。
 */
function generate() {
  const excludeShape = SHAPE_IDS[randInt(0, SHAPE_IDS.length - 1)]
  const others = shuffle(SHAPE_IDS.filter((s) => s !== excludeShape))
  const excludeCount = randInt(2, 3)
  const sizes = new Set<number>()
  while (sizes.size < 3 + excludeCount) sizes.add(randInt(34, 88))
  const sizeList = [...sizes].sort((a, b) => b - a)
  // 除外図形の中に一番大きいサイズを混ぜ込み、図形を無視した「サイズだけ最大」への誤答を誘発する。
  const trapSize = sizeList[0]
  const otherSizes = sizeList.slice(1, 4)
  const excludeSizes = [trapSize, ...sizeList.slice(4)]

  const items: Item[] = [
    ...others.map((s, i) => ({ id: i, shape: s, size: otherSizes[i] })),
    ...excludeSizes.map((s, i) => ({ id: 3 + i, shape: excludeShape, size: s })),
  ]
  const target = Math.max(...otherSizes)
  return { items: shuffle(items), excludeShape, target }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items, excludeShape, target } = spec.data as { items: Item[]; excludeShape: ShapeId; target: number }
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
    <QuestionShell instruction={`${SHAPE_LABELS[excludeShape]}以外で\n一番大きいものを押せ！`}>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => finish(it.size === target && it.shape !== excludeShape)}
            className="flex h-20 w-20 items-center justify-center active:scale-90"
          >
            <ShapeIcon shape={it.shape} size={it.size} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalLargestNonRedCircleModule: FinalQuestionModule = {
  id: 'finalLargestNonRedCircle',
  tags: ['visual', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
