import { useEffect, useRef, useState } from 'react'
import { ShapeIcon, SHAPE_IDS, type ShapeId } from '../../components/ShapeIcon'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const LIGHT_STEP_MS = 550

/**
 * Ver.6 Phase 1: 旧「光った色を逆順に全て押せ！」（色識別が正解条件だった問題）を、
 * 4種の図形（○△□×、位置は固定）が光る順番を覚える課題に再設計した。
 */
function generate() {
  const sequence = shuffle(SHAPE_IDS)
  const answerOrder = [...sequence].reverse()
  return { sequence, answerOrder }
}

/** 回答フェーズだけの時間。記憶表示（4図形×LIGHT_STEP_MS）は別途保証されtimeoutに含めない。 */
function computeTargetTimeMs() {
  return TIMING_SAFETY.final.memoryAnswerMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { sequence, answerOrder } = spec.data as { sequence: ShapeId[]; answerOrder: ShapeId[] }
  const [litShape, setLitShape] = useState<ShapeId | null>(null)
  const [revealDone, setRevealDone] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    sequence.forEach((shape, i) => {
      timers.push(setTimeout(() => setLitShape(shape), i * LIGHT_STEP_MS))
    })
    timers.push(
      setTimeout(
        () => {
          setLitShape(null)
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

  function handleTap(shape: ShapeId) {
    if (!revealDone || guardRef.current!.isResolved) return
    const expected = answerOrder[answeredCount]
    if (shape !== expected) {
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
    <QuestionShell instruction={revealDone ? '光った図形を\n逆順に全て押せ！' : '光る図形の順番を覚えろ！'}>
      <div className="grid grid-cols-2 gap-4">
        {SHAPE_IDS.map((s) => (
          <button
            key={s}
            onPointerDown={() => handleTap(s)}
            disabled={!revealDone}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 transition-opacity active:scale-90"
            style={{ opacity: litShape === s ? 1 : revealDone ? 1 : 0.25 }}
          >
            <ShapeIcon shape={s} size={44} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalColorReverseSequenceModule: FinalQuestionModule = {
  id: 'finalColorReverseSequence',
  tags: ['memory', 'sequence', 'reverse'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
