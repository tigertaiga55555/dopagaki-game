import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pickExcluding, randInt, shuffle } from '../../engine/random'
import { colorSymbol, COLOR_SYMBOL_STYLE } from '../colorSymbols'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const COLORS = [
  { id: 'red', hex: '#ef4444' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'green', hex: '#22c55e' },
  { id: 'yellow', hex: '#eab308' },
] as const

interface Circle {
  id: number
  colorId: string
  hex: string
}

/**
 * FINAL DOPA TRIAL Q1〜Q4（反転・一段難化プール）：「仲間外れ以外を全て押せ！」。
 * 通常の「周りと違う色を1つ押す」を反転し、「仲間（多数派の色）を全部押す」多重選択にする。
 * 仲間外れそのものを押すと即MISS。
 */
function generate() {
  const main = COLORS[randInt(0, COLORS.length - 1)]
  const odd = pickExcluding(COLORS, main)
  const oddId = randInt(0, 4)
  const circles: Circle[] = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    colorId: i === oddId ? odd.id : main.id,
    hex: i === oddId ? odd.hex : main.hex,
  }))
  return { circles: shuffle(circles), oddId, requiredCount: 4 }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { circles, oddId, requiredCount } = spec.data as { circles: Circle[]; oddId: number; requiredCount: number }
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

  function handleTap(circle: Circle) {
    if (guardRef.current!.isResolved || cleared.has(circle.id)) return
    if (circle.id === oddId) {
      finish(false)
      return
    }
    const next = new Set(cleared)
    next.add(circle.id)
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
        {circles.map((c) => (
          <button
            key={c.id}
            onPointerDown={() => handleTap(c)}
            className="flex h-16 w-16 items-center justify-center rounded-full text-lg transition-opacity active:scale-90"
            style={{ backgroundColor: c.hex, opacity: cleared.has(c.id) ? 0.15 : 1 }}
          >
            <span style={COLOR_SYMBOL_STYLE}>{colorSymbol(c.colorId)}</span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeOddOneOutModule: FinalQuestionModule = {
  id: 'finalExcludeOddOneOut',
  tags: ['color', 'reverse', 'inhibition'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
