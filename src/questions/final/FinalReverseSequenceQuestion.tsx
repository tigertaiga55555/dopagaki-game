import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const SLOTS = [
  { id: 0, label: '左上' },
  { id: 1, label: '右上' },
  { id: 2, label: '左下' },
  { id: 3, label: '右下' },
] as const

const LIGHT_STEP_MS = 550

/**
 * FINAL DOPA TRIAL Q9〜Q12（記憶＋判断プール）：「光った順番を逆から全て押せ！」。
 * 4つの地点が順番に光る（記憶表示。timeoutは一切消費しない）→消灯→プレイヤーは
 * 光った順とは逆の順番でタップする。指示は光る前に必ず表示する。
 */
function generate() {
  const sequence = shuffle(SLOTS).map((s) => s.id)
  const answerOrder = [...sequence].reverse()
  return { sequence, answerOrder }
}

/** 回答フェーズだけの時間。記憶表示（4地点×LIGHT_STEP_MS）は別途保証されtimeoutに含めない。 */
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
    sequence.forEach((slotId, i) => {
      timers.push(setTimeout(() => setLitIndex(slotId), i * LIGHT_STEP_MS))
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

  function handleTap(slotId: number) {
    if (!revealDone || guardRef.current!.isResolved) return
    const expected = answerOrder[answeredCount]
    if (slotId !== expected) {
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
    <QuestionShell instruction={revealDone ? '光った順番を\n逆から全て押せ！' : '順番を覚えろ！'}>
      <div className="grid grid-cols-2 gap-4">
        {SLOTS.map((s) => (
          <button
            key={s.id}
            onPointerDown={() => handleTap(s.id)}
            disabled={!revealDone}
            className={`flex h-20 w-20 items-center justify-center rounded-2xl text-xs font-bold active:scale-90 ${
              litIndex === s.id ? 'bg-amber-300' : 'bg-white/10 text-white/50'
            }`}
          >
            {revealDone ? '' : s.label}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalReverseSequenceModule: FinalQuestionModule = {
  id: 'finalReverseSequence',
  tags: ['memory', 'sequence', 'reverse', 'visual'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
