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

const HAND_STEP_MS = 700
const SEQUENCE_LENGTH = 3

function winningHandAgainst(opponent: HandId): HandId {
  return HANDS.find((h) => h.beats === opponent)!.id
}

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「逆順に全部勝て！」。
 * FinalRpsForwardSequenceQuestion（記憶＋判断プール）の高難度版。「逆順に全部勝て！」の
 * 指示は相手の手の並びを見せる前に必ず表示する。3つの相手の手を記憶した後、
 * 表示順とは逆の順番で、それぞれに勝つ手を選んでいく（記憶＋反転＋判断の複合）。
 */
function generate() {
  const sequence: HandId[] = Array.from({ length: SEQUENCE_LENGTH }, () => pick(HANDS).id)
  const answerSequence = [...sequence].reverse().map(winningHandAgainst)
  return { sequence, answerSequence }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { sequence, answerSequence } = spec.data as { sequence: HandId[]; answerSequence: HandId[] }
  const [revealIndex, setRevealIndex] = useState(-1)
  const [revealDone, setRevealDone] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    sequence.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealIndex(i), i * HAND_STEP_MS))
    })
    timers.push(
      setTimeout(
        () => {
          setRevealIndex(-1)
          setRevealDone(true)
          startRef.current = performance.now()
          failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
        },
        sequence.length * HAND_STEP_MS,
      ),
    )
    return () => {
      timers.forEach(clearTimeout)
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: startRef.current !== null ? performance.now() - startRef.current : 0 })
  }

  function handleTap(hand: HandId) {
    if (!revealDone || guardRef.current!.isResolved) return
    const expected = answerSequence[answeredCount]
    if (hand !== expected) {
      finish(false)
      return
    }
    const next = answeredCount + 1
    setAnsweredCount(next)
    if (next >= answerSequence.length) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell sub={revealDone ? '覚えた順番の逆から勝て' : '相手の手を覚えろ'} instruction="逆順に全部勝て！">
      {!revealDone && (
        <p className="text-6xl">{revealIndex >= 0 ? HANDS.find((h) => h.id === sequence[revealIndex])!.glyph : '？'}</p>
      )}
      {revealDone && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-bold text-amber-200/80">
            {answeredCount} / {answerSequence.length}
          </p>
          <div className="flex gap-3">
            {HANDS.map((h) => (
              <button
                key={h.id}
                onPointerDown={() => handleTap(h.id)}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl active:scale-90"
              >
                {h.glyph}
              </button>
            ))}
          </div>
        </div>
      )}
    </QuestionShell>
  )
}

export const FinalRpsReverseSequenceModule: FinalQuestionModule = {
  id: 'finalRpsReverseSequence',
  tags: ['memory', 'rps', 'sequence', 'reverse'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
