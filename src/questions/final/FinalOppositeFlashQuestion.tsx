import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import { sfx } from '../../utils/sound'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/** 2x2象限（0=左上,1=右上,2=左下,3=右下）の対角（反対側）マッピング。 */
const OPPOSITE = [3, 2, 1, 0]
const PRE_DELAY_MS = 450
const FLASH_DURATION_MS = 380

/**
 * FINAL DOPA TRIAL Q1〜Q4（反転・一段難化プール）：「光った場所の反対を押せ！」。
 * 4象限のうち1つが一瞬光る。プレイヤーは光った場所ではなく、その対角（反対側）を押す。
 */
function generate() {
  const flashIndex = randInt(0, 3)
  return { flashIndex, target: OPPOSITE[flashIndex] }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.reversalMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { flashIndex, target } = spec.data as { flashIndex: number; target: number }
  const [flashed, setFlashed] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const onTimer = setTimeout(() => {
      setFlashed(true)
      setFlashing(true)
      sfx.flashTick()
    }, PRE_DELAY_MS)
    const offTimer = setTimeout(() => setFlashing(false), PRE_DELAY_MS + FLASH_DURATION_MS)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(onTimer)
      clearTimeout(offTimer)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handleTap(index: number) {
    if (!flashed || guardRef.current!.isResolved) return
    finish(index === target)
  }

  return (
    <QuestionShell instruction={'光った場所の\n反対を押せ！'}>
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(i)}
            className={`h-20 w-20 rounded-2xl border-4 transition-all active:scale-90 ${
              flashing && i === flashIndex
                ? 'scale-110 border-amber-200 bg-amber-300 shadow-[0_0_35px_rgba(252,211,77,0.9)]'
                : 'border-white/10 bg-white/10'
            }`}
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalOppositeFlashModule: FinalQuestionModule = {
  id: 'finalOppositeFlash',
  tags: ['visual', 'reverse'],
  tier: 'reversal',
  generate,
  computeTargetTimeMs,
  Component,
}
