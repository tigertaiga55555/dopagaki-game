import { useEffect, useRef } from 'react'
import { ShapeIcon, SHAPE_IDS, type ShapeId } from '../components/ShapeIcon'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pickExcluding, randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import { useQuestionStartRef } from './useQuestionStartRef'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * Ver.6 Phase 1: 旧「周りと違う色を押せ！」（色識別が正解条件だった問題）を、
 * 同じ図形3つ＋違う図形1つを見分ける課題に置き換えた。表示は全て同色（白一色）に
 * 統一しており、正解条件は図形の種類のみで決まる。
 */
function generate() {
  const main = SHAPE_IDS[randInt(0, SHAPE_IDS.length - 1)]
  const odd = pickExcluding(SHAPE_IDS, main)
  const oddIndex = randInt(0, 3)
  const shapes = [0, 1, 2, 3].map((i) => (i === oddIndex ? odd : main))
  return { shapes, oddIndex }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { shapes, oddIndex } = spec.data as { shapes: ShapeId[]; oddIndex: number }
  const startRef = useQuestionStartRef()
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell instruction="仲間と違う形を押せ！">
      <div className="grid grid-cols-2 gap-4">
        {shapes.map((s, i) => (
          <button
            key={i}
            onPointerDown={() => finish(i === oddIndex)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 active:scale-90"
          >
            <ShapeIcon shape={s} size={48} />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const DifferentOneQuestionModule: QuestionModule = {
  id: 'differentOne',
  category: 'visual',
  baseTargetTimeMs: 1800,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.reactionMinMs.differentOne,
}
