import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const LIGHT_STEP_MS = 500

/**
 * FINAL DOPA TRIAL Q9〜Q12（記憶＋判断プール）：「光らなかった場所を押せ！」。
 * 5つの地点のうち4つが順番に光る（記憶表示。timeoutは一切消費しない）→消灯→
 * プレイヤーは一度も光らなかった1つを見つけてタップする。
 */
function generate() {
  const slotIds = [0, 1, 2, 3, 4]
  const lightSequence = shuffle(slotIds).slice(0, 4)
  const neverLit = slotIds.find((id) => !lightSequence.includes(id))!
  return { lightSequence, target: neverLit }
}

/** 回答フェーズだけの時間。記憶表示（4地点×LIGHT_STEP_MS）は別途保証されtimeoutに含めない。 */
function computeTargetTimeMs() {
  return TIMING_SAFETY.final.memoryAnswerMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { lightSequence, target } = spec.data as { lightSequence: number[]; target: number }
  const [litIndex, setLitIndex] = useState(-1)
  const [revealDone, setRevealDone] = useState(false)
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    lightSequence.forEach((slotId, i) => {
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
        lightSequence.length * LIGHT_STEP_MS,
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
    finish(slotId === target)
  }

  return (
    <QuestionShell instruction={revealDone ? '光らなかった場所を\n押せ！' : '光る場所を覚えろ！'}>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4].map((id) => (
          <button
            key={id}
            onPointerDown={() => handleTap(id)}
            disabled={!revealDone}
            className={`h-16 w-16 rounded-full border-4 transition-all active:scale-90 ${
              litIndex === id ? 'scale-110 border-amber-200 bg-amber-300 shadow-[0_0_25px_rgba(252,211,77,0.9)]' : 'border-white/10 bg-white/10'
            }`}
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalNeverLitSpotModule: FinalQuestionModule = {
  id: 'finalNeverLitSpot',
  tags: ['memory', 'visual'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
