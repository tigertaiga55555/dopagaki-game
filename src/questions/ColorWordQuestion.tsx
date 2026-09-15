import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick, pickExcluding, shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

const COLORS = [
  { id: 'red', label: '赤', word: 'あか', hex: '#ef4444' },
  { id: 'blue', label: '青', word: 'あお', hex: '#3b82f6' },
  { id: 'green', label: '緑', word: 'みどり', hex: '#22c55e' },
  { id: 'yellow', label: '黄', word: 'きいろ', hex: '#eab308' },
]

/** 「文字の色！」：ストループ課題。文字の意味ではなく実際の描画色を選ぶ。 */
function generate() {
  const wordColor = pick(COLORS)
  // 8割は文字の意味と表示色をわざとズラす（ストループ効果を狙う）。2割は一致させて油断させない。
  const displayColor = Math.random() < 0.8 ? pickExcluding(COLORS, wordColor) : wordColor
  return { word: wordColor.word, displayColor, wordMeaningId: wordColor.id, options: shuffle(COLORS) }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.colorWord.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { word, displayColor, wordMeaningId, options } = spec.data as {
    word: string
    displayColor: (typeof COLORS)[0]
    wordMeaningId: string
    options: typeof COLORS
  }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, pickedId?: string) {
    if (doneRef.current) return
    doneRef.current = true
    if (correct) sfx.colorWordHit()
    const fooledByWord = !correct && pickedId !== undefined && pickedId === wordMeaningId && wordMeaningId !== displayColor.id
    onResult({
      correct,
      reactionMs: performance.now() - startRef.current,
      meta: fooledByWord ? { fooledByWord: true } : undefined,
    })
  }

  return (
    <QuestionShell sub="文字の意味ではなく色で" instruction="文字の色！">
      <p className="text-6xl font-black" style={{ color: displayColor.hex }}>
        {word}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {options.map((c) => (
          <button
            key={c.id}
            onPointerDown={() => finish(c.id === displayColor.id, c.id)}
            className="h-16 w-16 rounded-full active:scale-90"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const ColorWordQuestionModule: QuestionModule = {
  id: 'colorWord',
  category: 'inhibition',
  baseTargetTimeMs: 1700,
  generate,
  Component,
  computeMinTargetTimeMs,
}
