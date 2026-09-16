import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const FLASH_STEP_MS = 600

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「光った数字のうち偶数だけ
 * 逆順に全て押せ！」。5つの数字が1つずつ順番に表示される（記憶負荷）→消える→
 * その中の偶数だけを「表示された順番と逆」に全てタップする（記憶＋抽出＋順序反転の複合）。
 */
function generate() {
  let sequence: number[] = []
  let evenSequence: number[] = []
  while (evenSequence.length < 2) {
    const numbers = new Set<number>()
    while (numbers.size < 5) numbers.add(randInt(1, 40))
    sequence = shuffle([...numbers])
    evenSequence = sequence.filter((n) => n % 2 === 0)
  }
  const answerOrder = [...evenSequence].reverse()
  return { sequence, answerOrder }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { sequence, answerOrder } = spec.data as { sequence: number[]; answerOrder: number[] }
  const [revealIndex, setRevealIndex] = useState(-1)
  const [revealDone, setRevealDone] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const answerButtonsRef = useRef(shuffle(sequence))
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    sequence.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealIndex(i), i * FLASH_STEP_MS))
    })
    timers.push(
      setTimeout(
        () => {
          setRevealIndex(-1)
          setRevealDone(true)
          startRef.current = performance.now()
          failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
        },
        sequence.length * FLASH_STEP_MS,
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

  function handleTap(n: number) {
    if (!revealDone || guardRef.current!.isResolved) return
    const expected = answerOrder[answeredCount]
    if (n !== expected) {
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
    <QuestionShell instruction={revealDone ? '偶数だけ\n逆順に全て押せ！' : '数字を覚えろ！'}>
      {!revealDone ? (
        <p className="text-6xl font-black text-white">{revealIndex >= 0 ? sequence[revealIndex] : '？'}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {answerButtonsRef.current.map((n, i) => (
            <button
              key={i}
              onPointerDown={() => handleTap(n)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </QuestionShell>
  )
}

export const FinalFlashEvenReverseModule: FinalQuestionModule = {
  id: 'finalFlashEvenReverse',
  tags: ['memory', 'number', 'sequence', 'reverse'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
