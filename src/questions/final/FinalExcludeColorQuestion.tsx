import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

interface Item {
  id: number
  shape: ShapeId
}

/**
 * Ver.6 Phase 1: 旧「○色以外を全て押せ！」（色識別が正解条件だった問題）を、
 * 指定図形以外を全て押す課題に再設計した。targetを2個、残り3図形から1個ずつ2個を
 * 混ぜた計4個を表示する。正解対象は「target以外の2個」、target図形を1つでも
 * 押すと即MISS、という判定ロジックは旧実装を踏襲している。
 */
function generate() {
  const target = pick(SHAPE_IDS)
  const others = shuffle(SHAPE_IDS.filter((s) => s !== target)).slice(0, 2)
  const items: Item[] = shuffle([
    { id: 0, shape: target },
    { id: 1, shape: target },
    { id: 2, shape: others[0] },
    { id: 3, shape: others[1] },
  ])
  return { items, targetShape: target, requiredCount: 2 }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items, targetShape, requiredCount } = spec.data as { items: Item[]; targetShape: ShapeId; requiredCount: number }
  const [cleared, setCleared] = useState<Set<number>>(new Set())
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
    if (guardRef.current!.isResolved || cleared.has(item.id)) return
    if (item.shape === targetShape) {
      finish(false)
      return
    }
    const next = new Set(cleared)
    next.add(item.id)
    setCleared(next)
    if (next.size >= requiredCount) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell instruction={`${SHAPE_LABELS[targetShape]}以外を\n全て押せ！`}>
      <div className="grid grid-cols-2 gap-4">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 transition-opacity active:scale-90"
            style={{ opacity: cleared.has(it.id) ? 0.15 : 1 }}
          >
            <ShapeIcon shape={it.shape} size={44} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeColorModule: FinalQuestionModule = {
  id: 'finalExcludeColor',
  tags: ['reverse', 'inhibition'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
