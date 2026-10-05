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

/**
 * Ver.6 Phase 1: 旧「◯以外を小さい順に全て押せ！」（色による除外が正解条件の一部だった
 * 問題）を、図形による除外に再設計した。除外図形を2個、非除外図形（3〜4図形から3個）を
 * 混ぜる構成・数字の昇順処理という複合判断ロジックは旧実装を踏襲している。
 */
function generate() {
  const excludeShape = pick(SHAPE_IDS)
  const others = shuffle(SHAPE_IDS.filter((s) => s !== excludeShape))
  const values = new Set<number>()
  while (values.size < 5) values.add(randInt(1, 30))
  const valueList = shuffle([...values])

  const other3 = others[randInt(0, others.length - 1)]
  const other4 = others[randInt(0, others.length - 1)]
  const items: Item[] = [
    { id: 0, value: valueList[0], shape: excludeShape },
    { id: 1, value: valueList[1], shape: excludeShape },
    { id: 2, value: valueList[2], shape: others[0] },
    { id: 3, value: valueList[3], shape: other3 },
    { id: 4, value: valueList[4], shape: other4 },
  ]
  const nonExcluded = items.filter((it) => it.shape !== excludeShape)
  const order = [...nonExcluded].sort((a, b) => a.value - b.value).map((it) => it.id)
  return { items: shuffle(items), excludeShape, order }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
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
    if (item.shape === excludeShape) {
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
    <QuestionShell instruction={`${SHAPE_LABELS[excludeShape]}以外を\n小さい順に全て押せ！`}>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-lg font-black text-white active:scale-90"
          >
            <ShapeIcon shape={it.shape} size={18} />
            {it.value}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeColorSortedModule: FinalQuestionModule = {
  id: 'finalExcludeColorSorted',
  tags: ['number', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
