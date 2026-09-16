import { useEffect, useRef, useState } from 'react'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, shuffle } from '../../engine/random'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q16（FINAL QUESTION＝専用ラスボス）：箱シャッフル追跡問題。
 *
 * 4つの箱（赤ボール／青ボール／黄ボール／空箱）の中身を最初に見せた後、フタを閉じて
 * シャッフルする。プレイヤーにはどの色を聞かれるか事前に教えない（＝赤だけを追う、
 * という攻略を封じ、4箱すべてを追跡させる）。シャッフル終了後に初めて質問色が決まり、
 * 該当ボールが今どの箱（スロット）にあるかを答えさせる。回答フェーズには時間制限がない。
 */

const CONTENTS = ['red', 'blue', 'yellow', 'empty'] as const
type ContentId = (typeof CONTENTS)[number]
const CONTENT_GLYPH: Record<ContentId, string> = { red: '🔴', blue: '🔵', yellow: '🟡', empty: '' }
const QUESTIONABLE_COLORS = ['red', 'blue', 'yellow'] as const
type QuestionColor = (typeof QUESTIONABLE_COLORS)[number]
const COLOR_LABEL: Record<QuestionColor, string> = { red: '赤', blue: '青', yellow: '黄' }

/** 2x2グリッドの4スロット位置（%指定）。 */
const SLOT_POSITIONS = [
  { x: 28, y: 34 },
  { x: 72, y: 34 },
  { x: 28, y: 78 },
  { x: 72, y: 78 },
]

/**
 * slotToBox（スロット→boxIdのマッピング）を1手ぶんだけ動かす関数群。
 * 2箱交換・3箱回転・4箱回転を混ぜることで「グルングルン動く」感覚を作る
 * （瞬間移動・重なって見えなくなる、はCSS transformでの位置移動のみを使うため発生しない）。
 */
type Permutation = (a: number[]) => number[]
const MOVES: Permutation[] = [
  (a) => [a[1], a[0], a[2], a[3]], // 0-1交換
  (a) => [a[0], a[1], a[3], a[2]], // 2-3交換
  (a) => [a[2], a[1], a[0], a[3]], // 0-2交換
  (a) => [a[0], a[3], a[2], a[1]], // 1-3交換
  (a) => [a[3], a[0], a[1], a[2]], // 4箱回転（正方向）
  (a) => [a[1], a[2], a[3], a[0]], // 4箱回転（逆方向）
  (a) => [a[2], a[0], a[1], a[3]], // 0-1-2の3箱回転
  (a) => [a[0], a[3], a[1], a[2]], // 1-2-3の3箱回転
]

const MOVE_COUNT = 9
/** 1手あたりの移動時間。9手×750ms≒6.75秒（「8〜12秒程度を目安」の範囲内で、実機確認しやすい長さに調整） */
const MOVE_DURATION_MS = 750
const REVEAL_MS = 2800
const LID_CLOSE_MS = 500

/**
 * シャッフルロジック本体。内部state（slotToBoxの最終形）と画面表示が必ず一致するよう、
 * ここで計算した最終slotToBoxとanswerSlotをそのままComponentのアニメーションにも使う
 * （Component側で独自に再計算しない＝内部stateと画面表示のズレが構造的に起こらない）。
 */
export function generateBoxShuffle() {
  const boxContents = shuffle(CONTENTS) as ContentId[] // boxContents[boxId] = そのboxIdの中身
  let slotToBox = [0, 1, 2, 3]
  const moveSequence: number[] = []
  let lastMoveIdx = -1
  for (let i = 0; i < MOVE_COUNT; i++) {
    let idx = Math.floor(Math.random() * MOVES.length)
    while (idx === lastMoveIdx) idx = Math.floor(Math.random() * MOVES.length)
    slotToBox = MOVES[idx](slotToBox)
    moveSequence.push(idx)
    lastMoveIdx = idx
  }
  const questionColor: QuestionColor = pick(QUESTIONABLE_COLORS)
  const answerBoxId = boxContents.indexOf(questionColor)
  const answerSlot = slotToBox.indexOf(answerBoxId)
  return { boxContents, moveSequence, questionColor, answerBoxId, answerSlot }
}

/** FINAL QUESTIONの回答フェーズには時間制限がない（39. FINAL QUESTIONは時間制限なし）。 */
function computeTargetTimeMs() {
  return 0
}

type Phase = 'reveal' | 'closing' | 'shuffling' | 'answer'

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { boxContents, moveSequence, questionColor, answerSlot } = spec.data as {
    boxContents: ContentId[]
    moveSequence: number[]
    questionColor: QuestionColor
    answerBoxId: number
    answerSlot: number
  }
  const [phase, setPhase] = useState<Phase>('reveal')
  const [slotToBox, setSlotToBox] = useState([0, 1, 2, 3])
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setPhase('closing'), REVEAL_MS))
    timers.push(
      setTimeout(() => {
        setPhase('shuffling')
        let current = [0, 1, 2, 3]
        moveSequence.forEach((moveIdx, i) => {
          timers.push(
            setTimeout(() => {
              current = MOVES[moveIdx](current)
              setSlotToBox([...current])
            }, i * MOVE_DURATION_MS),
          )
        })
        timers.push(
          setTimeout(
            () => {
              setPhase('answer')
              startRef.current = performance.now()
            },
            moveSequence.length * MOVE_DURATION_MS,
          ),
        )
      }, REVEAL_MS + LID_CLOSE_MS),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 40. シャッフル中タップは無視、即MISSにしない（回答受付開始後のみ判定）。
  function handleTap(slot: number) {
    if (phase !== 'answer' || guardRef.current!.isResolved) return
    guardRef.current!.resolve({
      correct: slot === answerSlot,
      reactionMs: startRef.current !== null ? performance.now() - startRef.current : 0,
    })
  }

  const headline =
    phase === 'reveal'
      ? '中身を覚えろ！'
      : phase === 'closing'
        ? 'フタを閉じる…'
        : phase === 'shuffling'
          ? '最後まで見失うな…'
          : `${COLOR_LABEL[questionColor]}のボールはどの箱？`

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center select-none">
      <p className="whitespace-pre-line text-2xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
        {headline}
      </p>
      <div className="relative h-64 w-full max-w-xs">
        {slotToBox.map((boxId, slot) => (
          <button
            key={boxId}
            onPointerDown={() => handleTap(slot)}
            style={{
              left: `${SLOT_POSITIONS[slot].x}%`,
              top: `${SLOT_POSITIONS[slot].y}%`,
              transition: 'left 0.7s ease-in-out, top 0.7s ease-in-out',
            }}
            className="absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-700 to-amber-900 text-3xl shadow-[0_6px_0_0_rgba(120,53,15,0.9)] active:scale-90"
          >
            {phase === 'reveal' ? CONTENT_GLYPH[boxContents[boxId]] : '📦'}
          </button>
        ))}
      </div>
    </div>
  )
}

export const FinalQuestionBoxModule: FinalQuestionModule = {
  id: 'finalQuestionBox',
  tags: ['memory', 'visual'],
  // Q16専用固定問題のためtierプールには含めない（値自体は型合わせのための形式的なもの）。
  tier: 'mixed',
  generate: generateBoxShuffle,
  computeTargetTimeMs,
  Component,
}
