import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const FLASH_STEP_MS = 600

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「光った数字のうち奇数だけ
 * 大きい順に全て押せ！」。FinalFlashEvenReverseQuestionと同じ記憶提示だが、
 * こちらは「表示された順番」ではなく「値の大きさ」で並べ替える必要がある点が異なる
 * （記憶＋抽出＋値によるソートの複合）。
 */
function generate() {
  let sequence: number[] = []
  let oddValues: number[] = []
  while (oddValues.length < 2) {
    const numbers = new Set<number>()
    while (numbers.size < 5) numbers.add(randInt(1, 40))
    sequence = shuffle([...numbers])
    oddValues = sequence.filter((n) => n % 2 !== 0)
  }
  const answerOrder = [...oddValues].sort((a, b) => b - a)
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
    <QuestionShell instruction={revealDone ? '奇数だけ\n大きい順に全て押せ！' : '数字を覚えろ！'}>
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

export const FinalFlashOddDescendingModule: FinalQuestionModule = {
  id: 'finalFlashOddDescending',
  tags: ['memory', 'number', 'sequence'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
