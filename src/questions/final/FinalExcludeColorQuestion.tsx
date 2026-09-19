import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, shuffle } from '../../engine/random'
import { colorSymbol, COLOR_SYMBOL_STYLE } from '../colorSymbols'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const COLORS = [
  { id: 'red', label: '赤', hex: '#ef4444' },
  { id: 'blue', label: '青', hex: '#3b82f6' },
  { id: 'green', label: '緑', hex: '#22c55e' },
  { id: 'yellow', label: '黄', hex: '#eab308' },
] as const
type ColorId = (typeof COLORS)[number]['id']

interface Circle {
  id: number
  colorId: ColorId
  hex: string
}

/**
 * FINAL DOPA TRIAL Q1〜Q4（反転・一段難化プール）：「○色以外を全て押せ！」。
 * targetカラーを2個、残り3色から1色ずつ2個を混ぜた計4個の円を表示する。正解対象は
 * 「target以外の2個」（複数）で、両方を押した時点でSUCCESS。target色を1つでも押すと即MISS。
 */
function generate() {
  const target = pick(COLORS)
  const others = shuffle(COLORS.filter((c) => c.id !== target.id)).slice(0, 2)
  const circles: Circle[] = shuffle([
    { id: 0, colorId: target.id, hex: target.hex },
    { id: 1, colorId: target.id, hex: target.hex },
    { id: 2, colorId: others[0].id, hex: others[0].hex },
    { id: 3, colorId: others[1].id, hex: others[1].hex },
  ])
  return { circles, targetColorId: target.id, targetLabel: target.label, requiredCount: 2 }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { circles, targetColorId, targetLabel, requiredCount } = spec.data as {
    circles: Circle[]
    targetColorId: ColorId
    targetLabel: string
    requiredCount: number
  }
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
    if (circle.colorId === targetColorId) {
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
    // 正しく1個押すたびに、残り猶予ぶんタイマーを引き直す（正しく操作中の理不尽timeoutを防ぐ）。
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell instruction={`${targetLabel}（${colorSymbol(targetColorId)}）以外を\n全て押せ！`}>
      <div className="grid grid-cols-2 gap-4">
        {circles.map((c) => (
          <button
            key={c.id}
            onPointerDown={() => handleTap(c)}
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl transition-opacity active:scale-90"
            style={{ backgroundColor: c.hex, opacity: cleared.has(c.id) ? 0.15 : 1 }}
          >
            <span style={COLOR_SYMBOL_STYLE}>{colorSymbol(c.colorId)}</span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeColorModule: FinalQuestionModule = {
  id: 'finalExcludeColor',
  tags: ['color', 'reverse', 'inhibition'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
