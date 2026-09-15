import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * 「緑になったら押せ！」（信号ゲーム）：早く押したいのに待たないといけない、という
 * ドパガキの衝動そのもの。Ver.4.3で「READY...→GO!」という文字切り替えから、
 * 信号機の色が変わる形に再設計した。指示文が常に固定されるため、
 * 何を待っているのかが初見でも視覚だけで理解できる。
 */
function generate() {
  return { waitMs: randInt(500, 1300) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { waitMs } = data as { waitMs: number }
  return waitMs + TIMING_SAFETY.goWait.minReactionWindowMs + TIMING_SAFETY.goWait.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { waitMs } = spec.data as { waitMs: number }
  const [isGreen, setIsGreen] = useState(false)
  const startRef = useRef(performance.now())
  const goAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const goTimer = setTimeout(() => {
      goAtRef.current = performance.now()
      setIsGreen(true)
      sfx.go()
    }, waitMs)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(goTimer)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, earlyPress = false) {
    if (doneRef.current) return
    doneRef.current = true
    if (!correct) {
      onResult({ correct: false, reactionMs: performance.now() - startRef.current, meta: earlyPress ? { earlyPress: true } : undefined })
      return
    }
    const goAt = goAtRef.current ?? performance.now()
    const reactionMs = performance.now() - goAt
    const ratioWindowMs = spec.targetTimeMs - waitMs
    onResult({ correct: true, reactionMs, ratioWindowMs })
  }

  function handlePress() {
    if (doneRef.current) return
    if (!isGreen) {
      finish(false, true)
      return
    }
    finish(true)
  }

  return (
    <QuestionShell instruction="緑になったら押せ！">
      <button
        onPointerDown={handlePress}
        className={`h-28 w-28 rounded-full border-4 text-2xl font-black text-white transition-colors active:scale-95 ${
          isGreen ? 'border-emerald-300 bg-gradient-to-b from-emerald-400 to-green-600' : 'border-white/10 bg-gray-500/40'
        }`}
      />
    </QuestionShell>
  )
}

export const GoWaitQuestionModule: QuestionModule = {
  id: 'goWait',
  category: 'inhibition',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
