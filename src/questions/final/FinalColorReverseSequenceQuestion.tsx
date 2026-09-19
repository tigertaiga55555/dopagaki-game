import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { shuffle } from '../../engine/random'
import { colorSymbol, COLOR_SYMBOL_STYLE } from '../colorSymbols'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const COLORS = [
  { id: 0, name: 'red', hex: '#ef4444' },
  { id: 1, name: 'blue', hex: '#3b82f6' },
  { id: 2, name: 'green', hex: '#22c55e' },
  { id: 3, name: 'yellow', hex: '#eab308' },
] as const

const LIGHT_STEP_MS = 550

/**
 * FINAL DOPA TRIAL Q9〜Q12（記憶＋判断プール）：「光った色を逆順に全て押せ！」。
 * FinalReverseSequenceQuestionの色版。4色の位置は固定、光る順番だけがランダムに変わる。
 */
function generate() {
  const sequence = shuffle(COLORS).map((c) => c.id)
  const answerOrder = [...sequence].reverse()
  return { sequence, answerOrder }
}

/** 回答フェーズだけの時間。記憶表示（4色×LIGHT_STEP_MS）は別途保証されtimeoutに含めない。 */
function computeTargetTimeMs() {
  return TIMING_SAFETY.final.memoryAnswerMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { sequence, answerOrder } = spec.data as { sequence: number[]; answerOrder: number[] }
  const [litIndex, setLitIndex] = useState(-1)
  const [revealDone, setRevealDone] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    sequence.forEach((colorId, i) => {
      timers.push(setTimeout(() => setLitIndex(colorId), i * LIGHT_STEP_MS))
    })
    timers.push(
      setTimeout(
        () => {
          setLitIndex(-1)
          setRevealDone(true)
          startRef.current = performance.now()
          failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
        },
        sequence.length * LIGHT_STEP_MS,
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

  function handleTap(colorId: number) {
    if (!revealDone || guardRef.current!.isResolved) return
    const expected = answerOrder[answeredCount]
    if (colorId !== expected) {
      finish(false)
      return
    }
    const next = answeredCount + 1
    setAnsweredCount(next)
    if (next >= answerOrder.length) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell instruction={revealDone ? '光った色を\n逆順に全て押せ！' : '光る色の順番を覚えろ！'}>
      <div className="grid grid-cols-2 gap-4">
        {COLORS.map((c) => (
          <button
            key={c.id}
            onPointerDown={() => handleTap(c.id)}
            disabled={!revealDone}
            className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl transition-opacity active:scale-90"
            style={{ backgroundColor: c.hex, opacity: litIndex === c.id ? 1 : revealDone ? 1 : 0.25 }}
          >
            <span style={COLOR_SYMBOL_STYLE}>{colorSymbol(c.name)}</span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalColorReverseSequenceModule: FinalQuestionModule = {
  id: 'finalColorReverseSequence',
  tags: ['memory', 'sequence', 'reverse', 'color'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
