import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const HANDS = [
  { id: 'rock', glyph: '👊', beats: 'scissors' },
  { id: 'scissors', glyph: '✌️', beats: 'paper' },
  { id: 'paper', glyph: '✋', beats: 'rock' },
] as const
type HandId = (typeof HANDS)[number]['id']

function handById(id: HandId) {
  return HANDS.find((h) => h.id === id)!
}

/**
 * FINAL DOPA TRIAL Q1〜Q4（反転・一段難化プール）：「勝つ手以外を全て押せ！」。
 * 相手の手に対して「勝つ手」以外の2つ（負ける手・あいこの手）を両方押す多重選択。
 * 勝つ手を押した瞬間、即MISS。
 */
function generate() {
  const opponent = pick(HANDS).id
  const winningHand = HANDS.find((h) => h.beats === opponent)!.id
  return { opponent, winningHand }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { opponent, winningHand } = spec.data as { opponent: HandId; winningHand: HandId }
  const [cleared, setCleared] = useState<Set<HandId>>(new Set())
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

  function handleTap(hand: HandId) {
    if (guardRef.current!.isResolved || cleared.has(hand)) return
    if (hand === winningHand) {
      finish(false)
      return
    }
    const next = new Set(cleared)
    next.add(hand)
    setCleared(next)
    if (next.size >= 2) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell sub="相手の手に対して" instruction={'勝つ手以外を\n全て押せ！'}>
      <p className="text-6xl">{handById(opponent).glyph}</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {HANDS.map((h) => (
          <button
            key={h.id}
            onPointerDown={() => handleTap(h.id)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl transition-opacity active:scale-90"
            style={{ opacity: cleared.has(h.id) ? 0.2 : 1 }}
          >
            {h.glyph}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeWinningHandModule: FinalQuestionModule = {
  id: 'finalExcludeWinningHand',
  tags: ['rps', 'reverse', 'inhibition'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
