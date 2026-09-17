import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

/** 空スポットの配置（4箇所固定）。 */
const SLOTS = [
  { x: 25, y: 30 },
  { x: 75, y: 30 },
  { x: 25, y: 70 },
  { x: 75, y: 70 },
]

/**
 * Ver.4.9で追加。「出てきた丸を押せ！」：最初は空のスポットだけを表示し、短いランダム
 * 待機後に1か所だけターゲットが出現する。出現前に押すと衝動ミス（impulsive）、
 * 出現後に正しいスポットを押せばSUCCESS、他のスポットを押すとMISS。
 * GO待ち系（goWait/skipWait）と操作感が近いため、questionPicker側のカテゴリ連続回避
 * （inhibition）で連続しすぎないようにする。
 */
function generate() {
  return { targetIndex: randInt(0, SLOTS.length - 1), preDelayMs: randInt(500, 1100) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { preDelayMs } = data as { preDelayMs: number }
  return preDelayMs + TIMING_SAFETY.popTarget.minReactionWindowMs + TIMING_SAFETY.popTarget.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { targetIndex, preDelayMs } = spec.data as { targetIndex: number; preDelayMs: number }
  const [appeared, setAppeared] = useState(false)
  const startRef = useRef(performance.now())
  const appearedAtRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const popTimer = setTimeout(() => {
      appearedAtRef.current = performance.now()
      setAppeared(true)
      sfx.flashTick()
    }, preDelayMs)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(popTimer)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, earlyPress = false) {
    if (!correct) {
      guardRef.current!.resolve({
        correct: false,
        reactionMs: performance.now() - startRef.current,
        meta: earlyPress ? { earlyPress: true } : undefined,
      })
      return
    }
    const appearedAt = appearedAtRef.current ?? performance.now()
    const reactionMs = performance.now() - appearedAt
    const ratioWindowMs = spec.targetTimeMs - preDelayMs
    guardRef.current!.resolve({ correct: true, reactionMs, ratioWindowMs })
  }

  function handleTap(index: number) {
    if (guardRef.current!.isResolved) return
    if (!appeared) {
      finish(false, true)
      return
    }
    finish(index === targetIndex)
  }

  return (
    <QuestionShell instruction={'出てきた丸を\n押せ！'}>
      <div className="relative h-56 w-full max-w-xs">
        {SLOTS.map((slot, i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(i)}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            className={`absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 transition-all active:scale-90 ${
              appeared && i === targetIndex
                ? 'anim-pop scale-110 border-amber-200 bg-amber-300 shadow-[0_0_30px_rgba(252,211,77,0.9)]'
                : 'border-white/15 bg-white/5'
            }`}
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const PopTargetQuestionModule: QuestionModule = {
  id: 'popTarget',
  category: 'inhibition',
  baseTargetTimeMs: 2200,
  generate,
  Component,
  computeMinTargetTimeMs,
}
