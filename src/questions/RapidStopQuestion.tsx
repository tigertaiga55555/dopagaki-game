import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** 1タップあたり現実的にかかる時間（連打の限界を考慮。requiredTapsがstopDelayMs内で必ず届くように使う） */
const RAPID_PER_TAP_MS = 150
/** 出題〜連打開始までに見込む反応時間 */
const RAPID_REACTION_BUFFER_MS = 250

/**
 * 「連打→急停止」：興奮して押しまくった指を止められるかを試す。
 * stopDelayMsに対してrequiredTapsが必ず物理的に届く組み合わせだけを生成する。
 */
function generate() {
  const stopDelayMs = randInt(650, 1100)
  const available = stopDelayMs - RAPID_REACTION_BUFFER_MS
  // requiredTaps回のタップにはその前後(requiredTaps-1)回分の間隔が必要になる
  const maxFeasibleTaps = available >= 3 * RAPID_PER_TAP_MS ? 4 : 3
  const requiredTaps = randInt(3, maxFeasibleTaps)
  return { stopDelayMs, requiredTaps }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { stopDelayMs } = data as { stopDelayMs: number }
  return stopDelayMs + TIMING_SAFETY.rapidStop.stopHoldMs + TIMING_SAFETY.rapidStop.safetyMarginMs
}

type Phase = 'rapid' | 'stop'

function Component({ spec, onResult }: QuestionComponentProps) {
  const { stopDelayMs, requiredTaps } = spec.data as { stopDelayMs: number; requiredTaps: number }
  const [phase, setPhase] = useState<Phase>('rapid')
  const [tapCount, setTapCount] = useState(0)
  const tapCountRef = useRef(0)
  const startRef = useRef(performance.now())
  const reachedAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const stopHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stopTimer = setTimeout(() => {
      setPhase('stop')
      sfx.brake()
      if (tapCountRef.current < requiredTaps) {
        finish(false, 0)
        return
      }
      stopHoldTimerRef.current = setTimeout(() => {
        finish(true, tapCountRef.current)
      }, TIMING_SAFETY.rapidStop.stopHoldMs)
    }, stopDelayMs)
    return () => {
      clearTimeout(stopTimer)
      if (stopHoldTimerRef.current) clearTimeout(stopHoldTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, finalTapCount: number, extraTapAfterStop = false) {
    if (doneRef.current) return
    doneRef.current = true
    if (stopHoldTimerRef.current) clearTimeout(stopHoldTimerRef.current)
    if (!correct) {
      onResult({
        correct: false,
        reactionMs: performance.now() - startRef.current,
        meta: extraTapAfterStop ? { extraTaps: 1 } : undefined,
      })
      return
    }
    const reactionMs = (reachedAtRef.current ?? performance.now()) - startRef.current
    const ratioWindowMs = requiredTaps * RAPID_PER_TAP_MS + RAPID_REACTION_BUFFER_MS
    onResult({ correct: true, reactionMs, ratioWindowMs, meta: { extraTaps: Math.max(0, finalTapCount - requiredTaps) } })
  }

  function handleTap() {
    if (doneRef.current) return
    if (phase === 'stop') {
      // 「止まれ！」後に押した＝止まれなかった
      finish(false, tapCountRef.current, true)
      return
    }
    tapCountRef.current += 1
    if (reachedAtRef.current === null && tapCountRef.current >= requiredTaps) {
      reachedAtRef.current = performance.now()
    }
    setTapCount(tapCountRef.current)
    sfx.tap()
  }

  return (
    <QuestionShell sub="緑は連打　赤で止まれ" instruction={phase === 'stop' ? 'STOP！' : '連打！！！'}>
      <button
        onPointerDown={handleTap}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-white active:scale-95 ${
          phase === 'stop' ? 'bg-gradient-to-b from-red-500 to-rose-700' : 'bg-gradient-to-b from-emerald-400 to-green-600'
        }`}
      >
        {tapCount}
      </button>
    </QuestionShell>
  )
}

export const RapidStopQuestionModule: QuestionModule = {
  id: 'rapidStop',
  category: 'rapid',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
