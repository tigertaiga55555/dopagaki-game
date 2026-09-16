import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q1〜Q4（反転・一段難化プール）：「大きい丸じゃない方を押せ！」。
 * 通常の「大きい丸を押せ」を反転し、小さい方を選ばせる。
 */
function generate() {
  let left = randInt(36, 90)
  let right = randInt(36, 90)
  while (Math.abs(left - right) < 20) right = randInt(36, 90)
  return { left, right }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { left, right } = spec.data as { left: number; right: number }
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell instruction={'大きい丸じゃない方を\n押せ！'}>
      <div className="flex w-full max-w-xs items-center justify-center gap-6">
        {[left, right].map((size, side) => (
          <button
            key={side}
            onPointerDown={() => finish(side === 0 ? left < right : right < left)}
            className="flex h-28 flex-1 items-center justify-center active:scale-95"
          >
            <span className="rounded-full bg-gradient-to-b from-fuchsia-400 to-purple-500" style={{ width: size, height: size }} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalNotBiggerCircleModule: FinalQuestionModule = {
  id: 'finalNotBiggerCircle',
  tags: ['visual', 'reverse'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
