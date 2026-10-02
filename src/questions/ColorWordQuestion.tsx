import { useEffect, useRef } from 'react'
import { ShapeIcon, SHAPE_IDS, type ShapeId } from '../components/ShapeIcon'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick, pickExcluding, shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import { useQuestionStartRef } from './useQuestionStartRef'
import type { QuestionComponentProps, QuestionModule } from '../types'

const SHAPE_WORDS: Record<ShapeId, string> = {
  circle: 'まる',
  triangle: 'さんかく',
  square: 'しかく',
  cross: 'ばつ',
}

/**
 * Ver.6 Phase 1: 旧「文字の色！」（ストループ課題、色の識別が正解条件だった）を、
 * 色覚特性に依存しない形へ再設計。文字で図形の名前（「さんかく」等）を見せつつ、
 * 実際に表示する図形アイコンはわざと一致させない（8割）ことで同じ「意味と実物の
 * ズレ」を狙うストループ効果を維持しつつ、判断材料を色ではなく図形の形そのものにした。
 */
function generate() {
  const wordShape = pick(SHAPE_IDS)
  // 8割は文字の意味と実際に表示する図形をわざとズラす。2割は一致させて油断させない。
  const displayShape = Math.random() < 0.8 ? pickExcluding(SHAPE_IDS, wordShape) : wordShape
  return { wordShape, displayShape, options: shuffle(SHAPE_IDS) }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.colorWord.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { wordShape, displayShape, options } = spec.data as { wordShape: ShapeId; displayShape: ShapeId; options: ShapeId[] }
  const startRef = useQuestionStartRef()
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, pickedShape?: ShapeId) {
    if (doneRef.current) return
    doneRef.current = true
    if (correct) sfx.colorWordHit()
    const fooledByWord = !correct && pickedShape !== undefined && pickedShape === wordShape && wordShape !== displayShape
    onResult({
      correct,
      reactionMs: performance.now() - startRef.current,
      meta: fooledByWord ? { fooledByWord: true } : undefined,
    })
  }

  return (
    <QuestionShell sub="文字の意味は無視する" instruction={'表示されている\n図形を押せ！'}>
      <p className="text-4xl font-black text-white/90">{SHAPE_WORDS[wordShape]}</p>
      <ShapeIcon shape={displayShape} size={64} />
      <div className="grid grid-cols-2 gap-4">
        {options.map((s) => (
          <button
            key={s}
            onPointerDown={() => finish(s === displayShape, s)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 active:scale-90"
          >
            <ShapeIcon shape={s} size={36} />
          </button>
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
