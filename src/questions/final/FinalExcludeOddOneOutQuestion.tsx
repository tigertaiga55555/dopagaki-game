import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, type ShapeId } from '../../components/ShapeIcon'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pickExcluding, randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

interface Item {
  id: number
  shape: ShapeId
}

/**
 * Ver.6 Phase 1: 旧「仲間外れ以外を全て押せ！」（色識別が正解条件だった問題）を、
 * 図形による仲間外れ判定に再設計した。通常の「周りと違う図形を1つ押す」を反転し、
 * 「仲間（多数派の図形）を全部押す」多重選択にする。仲間外れそのものを押すと即MISS。
 */
function generate() {
  const main = SHAPE_IDS[randInt(0, SHAPE_IDS.length - 1)]
  const odd = pickExcluding(SHAPE_IDS, main)
  const oddId = randInt(0, 4)
  const items: Item[] = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    shape: i === oddId ? odd : main,
  }))
  return { items: shuffle(items), oddId, requiredCount: 4 }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items, oddId, requiredCount } = spec.data as { items: Item[]; oddId: number; requiredCount: number }
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
    if (item.id === oddId) {
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
    <QuestionShell instruction={'仲間外れ以外を\n全て押せ！'}>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 transition-opacity active:scale-90"
            style={{ opacity: cleared.has(it.id) ? 0.15 : 1 }}
          >
            <ShapeIcon shape={it.shape} size={36} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeOddOneOutModule: FinalQuestionModule = {
  id: 'finalExcludeOddOneOut',
  tags: ['reverse', 'inhibition'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
