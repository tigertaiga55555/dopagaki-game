import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

interface Item {
  id: number
  value: number
  shape: ShapeId
}

/** 除外図形2〜3個を強制的に混ぜつつ残りをランダムに割り当て、「非除外図形かつ偶数」が3個以上になるまで作り直す。 */
function buildCandidate() {
  const excludeShape = pick(SHAPE_IDS)
  const others = SHAPE_IDS.filter((s) => s !== excludeShape)
  const itemCount = randInt(6, 8)
  const forcedExcludedCount = randInt(2, 3)

  const values = new Set<number>()
  while (values.size < itemCount) values.add(randInt(1, 40))
  const valueList = shuffle([...values])

  const shapes: ShapeId[] = []
  for (let i = 0; i < forcedExcludedCount; i++) shapes.push(excludeShape)
  for (let i = forcedExcludedCount; i < itemCount; i++) shapes.push(pick(others))
  const shuffledShapes = shuffle(shapes)

  const items: Item[] = valueList.map((value, i) => ({ id: i, value, shape: shuffledShapes[i] }))
  const targets = items.filter((it) => it.shape !== excludeShape && it.value % 2 === 0)
  const order = [...targets].sort((a, b) => a.value - b.value).map((it) => it.id)
  return { items, excludeShape, order }
}

/**
 * Ver.6 Phase 1: 旧「◯以外の偶数を小さい順に全て押せ！」（色識別が正解条件の一部だった
 * ULTIMATE QUESTION候補）を、図形による除外に再設計した。図形による除外→偶数抽出→
 * 昇順ソート→複数タップ、という4段階の処理を要求する構成は旧実装を踏襲している。
 * 6〜8個の候補から必ず3個以上の正解ターゲットが出るまで生成をやり直す。
 */
function generate() {
  let candidate = buildCandidate()
  while (candidate.order.length < 3) candidate = buildCandidate()
  return {
    items: shuffle(candidate.items),
    excludeShape: candidate.excludeShape,
    order: candidate.order,
  }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.ultimate1Ms
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items, excludeShape, order } = spec.data as { items: Item[]; excludeShape: ShapeId; order: number[] }
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

  function handleTap(item: Item) {
    if (guardRef.current!.isResolved) return
    const isTarget = item.shape !== excludeShape && item.value % 2 === 0
    if (!isTarget) {
      finish(false)
      return
    }
    const expected = order[clearedCount]
    if (item.id !== expected) {
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
    <QuestionShell instruction={`${SHAPE_LABELS[excludeShape]}以外の偶数を\n小さい順に全て押せ！`}>
      <div className="grid grid-cols-4 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-base font-black text-white active:scale-90"
          >
            <ShapeIcon shape={it.shape} size={16} />
            {it.value}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalUltimateColorEvenSortModule: FinalQuestionModule = {
  id: 'finalUltimateColorEvenSort',
  tags: ['number', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
