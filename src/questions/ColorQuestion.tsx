import { useEffect, useRef } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../components/ShapeIcon'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick, shuffle } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import { useQuestionStartRef } from './useQuestionStartRef'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * Ver.6 Phase 1: 旧「○色を押せ！」（色識別が正解条件だった問題）を、色覚特性に
 * 依存しない図形（○△□×）の識別に置き換えた。typeId（'color'）・難易度調整・
 * プール登録は変更せず、内部の正解条件と描画だけを色→図形に差し替えている。
 */
function generate() {
  return { target: pick(SHAPE_IDS), options: shuffle(SHAPE_IDS) }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { target, options } = spec.data as { target: ShapeId; options: ShapeId[] }
  const startRef = useQuestionStartRef()
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false, spec.targetTimeMs), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, reactionMs: number) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs })
  }

  return (
    <QuestionShell instruction={`${SHAPE_LABELS[target]}を押せ！`}>
      <div className="grid grid-cols-2 gap-5">
        {options.map((s) => (
          <button
            key={s}
            onPointerDown={() => finish(s === target, performance.now() - startRef.current)}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 active:scale-90"
          >
            <ShapeIcon shape={s} size={44} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const ColorQuestionModule: QuestionModule = {
  id: 'color',
  category: 'reaction',
  baseTargetTimeMs: 1400,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.reactionMinMs.color,
}
