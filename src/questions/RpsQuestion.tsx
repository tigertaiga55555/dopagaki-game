import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

const HANDS = [
  { id: 'rock', glyph: '👊', beats: 'scissors' },
  { id: 'scissors', glyph: '✌️', beats: 'paper' },
  { id: 'paper', glyph: '✋', beats: 'rock' },
] as const
type HandId = (typeof HANDS)[number]['id']

const INSTRUCTIONS = ['win', 'lose', 'tie'] as const
type Instruction = (typeof INSTRUCTIONS)[number]

const INSTRUCTION_LABEL: Record<Instruction, string> = {
  win: '勝て！',
  lose: '負けろ！',
  tie: 'あいこにしろ！',
}

function handById(id: HandId) {
  return HANDS.find((h) => h.id === id)!
}

/** opponentに対してinstructionを満たす手を1つ返す（勝て＝opponentに勝つ手、負けろ＝opponentが勝つ手、あいこ＝同じ手）。 */
function correctHandFor(opponent: HandId, instruction: Instruction): HandId {
  if (instruction === 'tie') return opponent
  if (instruction === 'win') {
    // opponentに勝つ手＝opponentを負かす手
    return HANDS.find((h) => h.beats === opponent)!.id
  }
  // 負けろ＝opponentに負ける手＝opponentが勝つ手
  return handById(opponent).beats
}

/**
 * Ver.5.0で追加。「じゃんけん」：相手の手を中央に表示し、「勝て！／負けろ！／あいこにしろ！」の
 * ランダム指示に従って正しい手を選ぶ。指示は常に相手の手と同時に表示する（後出し表示はしない）。
 */
function generate() {
  const opponent = pick(HANDS).id
  const instruction = pick(INSTRUCTIONS)
  const correct = correctHandFor(opponent, instruction)
  return { opponent, instruction, correct }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.rps.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { opponent, instruction, correct } = spec.data as { opponent: HandId; instruction: Instruction; correct: HandId }
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(isCorrect: boolean) {
    guardRef.current!.resolve({ correct: isCorrect, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell sub="相手の手に正しく応じろ" instruction={INSTRUCTION_LABEL[instruction]}>
      <p className="text-7xl">{handById(opponent).glyph}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {HANDS.map((h) => (
          <button
            key={h.id}
            onPointerDown={() => finish(h.id === correct)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl active:scale-90"
          >
            {h.glyph}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const RpsQuestionModule: QuestionModule = {
  id: 'rps',
  category: 'reaction',
  baseTargetTimeMs: 2000,
  generate,
  Component,
  computeMinTargetTimeMs,
}
