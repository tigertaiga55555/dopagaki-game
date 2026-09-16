import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** 4つの数字を置く候補位置（%指定）。ランダムに4つ選んでシャッフルし、散らばった配置にする。 */
const SLOTS = [
  { x: 20, y: 15 },
  { x: 70, y: 10 },
  { x: 15, y: 55 },
  { x: 75, y: 60 },
  { x: 45, y: 30 },
  { x: 50, y: 75 },
]

interface NumberSlot {
  value: number
  x: number
  y: number
}

/**
 * 「1→4！」：4つの数字を順番通りに素早く見つけてタップする。
 *
 * Ver.4.6の重要な修正：外側の汎用タイムアウトが一度きりだったため、1つ目を見つけるのに
 * 想定よりわずかに時間がかかっただけで、正しく順番通りタップしている最中にタイムアウトが
 * 先に発火してMISSになるレースがあった。正しくタップするたびに、残りの数字ぶんの猶予で
 * タイマーを引き直すことでこれを防ぐ。
 */
function generate() {
  const slots = shuffle(SLOTS).slice(0, 4)
  const numbers: NumberSlot[] = shuffle([1, 2, 3, 4]).map((value, i) => ({ value, x: slots[i].x, y: slots[i].y }))
  return { numbers }
}

function computeMinTargetTimeMs() {
  return 4 * TIMING_SAFETY.sequenceTap.perNumberMs + TIMING_SAFETY.sequenceTap.reactionBufferMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { numbers } = spec.data as { numbers: NumberSlot[] }
  const [nextExpected, setNextExpected] = useState(1)
  const nextExpectedRef = useRef(1)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, wrongOrder = false) {
    if (doneRef.current) return
    doneRef.current = true
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    onResult({
      correct,
      reactionMs: performance.now() - startRef.current,
      meta: wrongOrder ? { wrongOrder: true } : undefined,
    })
  }

  function handleTap(value: number) {
    if (doneRef.current) return
    if (value !== nextExpectedRef.current) {
      finish(false, true)
      return
    }
    sfx.sequenceTap(value)
    if (value >= 4) {
      finish(true)
      return
    }
    nextExpectedRef.current = value + 1
    setNextExpected(value + 1)
    // 正しくタップするたびに、残りの数字ぶんの猶予で外側タイマーを引き直す。
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    const remaining = 4 - value
    failTimerRef.current = setTimeout(
      () => finish(false),
      remaining * TIMING_SAFETY.sequenceTap.perNumberMs + TIMING_SAFETY.sequenceTap.reactionBufferMs,
    )
  }

  return (
    <QuestionShell instruction={'1 → 2 → 3 → 4\nの順に押せ！'}>
      <div className="relative h-64 w-full max-w-xs">
        {numbers.map((n) => (
          <button
            key={n.value}
            onPointerDown={() => handleTap(n.value)}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-black text-white active:scale-90 ${
              n.value < nextExpected ? 'bg-emerald-600/70' : 'bg-fuchsia-500/90'
            }`}
          >
            {n.value}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const SequenceTapQuestionModule: QuestionModule = {
  id: 'sequenceTap',
  category: 'memory',
  baseTargetTimeMs: 2000,
  generate,
  Component,
  computeMinTargetTimeMs,
}
