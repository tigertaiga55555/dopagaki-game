import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt, shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const ICON_POOL = ['😀', '⭐', '🍎', '🚗', '🐶', '🔥', '⚽', '🍌', '🎈', '🎵', '🌙', '☂️']

interface Icon {
  id: number
  emoji: string
  isTarget: boolean
}

/** 「〇〇を探せ！」：8〜12個の中から指定されたアイコンを見つけてタップする。 */
function generate() {
  const target = ICON_POOL[randInt(0, ICON_POOL.length - 1)]
  const count = randInt(8, 12)
  const icons: Icon[] = [{ id: 0, emoji: target, isTarget: true }]
  for (let i = 1; i < count; i++) {
    icons.push({ id: i, emoji: pickExcluding(ICON_POOL, target), isTarget: false })
  }
  return { target, icons: shuffle(icons) }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.findTarget.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { target, icons } = spec.data as { target: string; icons: Icon[] }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    if (correct) sfx.targetFound()
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell instruction={`${target}を探せ！`}>
      <div className="grid grid-cols-4 gap-3">
        {icons.map((icon) => (
          <button
            key={icon.id}
            onPointerDown={() => finish(icon.isTarget)}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl active:scale-90"
          >
            {icon.emoji}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FindTargetQuestionModule: QuestionModule = {
  id: 'findTarget',
  category: 'visual',
  baseTargetTimeMs: 1800,
  generate,
  Component,
  computeMinTargetTimeMs,
}
