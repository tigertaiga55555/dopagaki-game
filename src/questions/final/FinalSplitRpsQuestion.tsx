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

function winningHandAgainst(opponent: HandId): HandId {
  return HANDS.find((h) => h.beats === opponent)!.id
}
function losingHandAgainst(opponent: HandId): HandId {
  return HANDS.find((h) => h.id === opponent)!.beats
}

/**
 * FINAL DOPA TRIAL Q5〜Q8（2条件処理プール）：「左には勝て、右には負けろ！」。
 * 左右で異なる相手の手・異なる指示（左=勝つ／右=負ける）が同時に出る2条件処理。
 * 両方を正しく選んで初めてSUCCESS。どちらかを間違えた瞬間、即MISS。
 */
function generate() {
  const leftOpponent = pick(HANDS).id
  const rightOpponent = pick(HANDS).id
  const leftCorrect = winningHandAgainst(leftOpponent)
  const rightCorrect = losingHandAgainst(rightOpponent)
  return { leftOpponent, rightOpponent, leftCorrect, rightCorrect }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.twoConditionMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { leftOpponent, rightOpponent, leftCorrect, rightCorrect } = spec.data as {
    leftOpponent: HandId
    rightOpponent: HandId
    leftCorrect: HandId
    rightCorrect: HandId
  }
  const [leftDone, setLeftDone] = useState(false)
  const [rightDone, setRightDone] = useState(false)
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

  function handleLeft(hand: HandId) {
    if (guardRef.current!.isResolved || leftDone) return
    if (hand !== leftCorrect) {
      finish(false)
      return
    }
    setLeftDone(true)
    if (rightDone) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  function handleRight(hand: HandId) {
    if (guardRef.current!.isResolved || rightDone) return
    if (hand !== rightCorrect) {
      finish(false)
      return
    }
    setRightDone(true)
    if (leftDone) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell instruction={'左には勝て、\n右には負けろ！'}>
      <div className="flex w-full items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <p className="text-4xl">{HANDS.find((h) => h.id === leftOpponent)!.glyph}</p>
          <div className="flex gap-2">
            {HANDS.map((h) => (
              <button
                key={h.id}
                onPointerDown={() => handleLeft(h.id)}
                className="flex h-12 w-12 items-center justify-center rounded-xl text-xl transition-opacity active:scale-90"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', opacity: leftDone ? 0.25 : 1 }}
              >
                {h.glyph}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-4xl">{HANDS.find((h) => h.id === rightOpponent)!.glyph}</p>
          <div className="flex gap-2">
            {HANDS.map((h) => (
              <button
                key={h.id}
                onPointerDown={() => handleRight(h.id)}
                className="flex h-12 w-12 items-center justify-center rounded-xl text-xl transition-opacity active:scale-90"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', opacity: rightDone ? 0.25 : 1 }}
              >
                {h.glyph}
              </button>
            ))}
          </div>
        </div>
      </div>
    </QuestionShell>
  )
}

export const FinalSplitRpsModule: FinalQuestionModule = {
  id: 'finalSplitRps',
  tags: ['rps', 'inhibition'],
  tier: 'twoCondition',
  generate,
  computeTargetTimeMs,
  Component,
}
