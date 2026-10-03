import { useRef, useState } from 'react'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { randInt, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule, Challenge500Tier } from './types'

interface Item {
  id: number
  value: number
  side: 'left' | 'right'
}

type Slot = 'size' | 'side'

/**
 * Ver.6 Phase 1（追加分）: FINAL DOPA TRIALの`FinalTop3DescendingQuestion`
 * （「大きい順に3つ押せ！」、6択から上位3つを正しい順序でタップする問題）を
 * 500%向けに転用。既存9系統は「1つだけ選ぶ」か「無順序の複数タップ」のいずれかだが、
 * 本問題は「正しい順序で複数回タップする」という新しい操作種別を導入する点が
 * ゲーム性として既存と被らない部分。
 *
 * ・tier1（200〜299%）：反転候補は「大きい/小さい」の1箇所のみ。6個中から
 *   上位3つ（大きい順）または下位3つ（小さい順）を正しい順序でタップするのが正解。
 * ・tier2（300〜399%）：位置条件「左/右」を追加し、反転候補は最大2箇所。
 * ・tier3（400〜499%）：反転しない通常条件「偶数の中で」を常に追加する。
 *
 * 正解の一意性は「distinctな値をsort()した結果から先頭3つを取り出す」という
 * 構造（値の重複がないため順位が必ず一意に決まる）で保証する。途中で1回でも
 * 違う値をタップした時点で即MISS（FinalTop3Descendingと同じ規則）。
 */
function buildItems(tier: Challenge500Tier): Item[] {
  if (tier === 1) {
    const values = new Set<number>()
    while (values.size < 6) values.add(randInt(1, 99))
    return [...values].map((value, id) => ({ id, value, side: 'left' as const }))
  }
  if (tier === 2) {
    const leftValues = new Set<number>()
    while (leftValues.size < 6) leftValues.add(randInt(1, 99))
    const rightValues = new Set<number>()
    while (rightValues.size < 6) rightValues.add(randInt(1, 99))
    return [
      ...[...leftValues].map((value, i) => ({ id: i, value, side: 'left' as const })),
      ...[...rightValues].map((value, i) => ({ id: i + 100, value, side: 'right' as const })),
    ]
  }
  // tier3: 各サイド偶数4個＋奇数2個（偶数だけに絞っても上位/下位3つが必ず定まるようにするため）。
  function buildParitySide(idOffset: number, side: 'left' | 'right'): Item[] {
    const evens = new Set<number>()
    while (evens.size < 4) evens.add(randInt(1, 49) * 2)
    const odds = new Set<number>()
    while (odds.size < 2) odds.add(randInt(1, 49) * 2 - 1)
    return [...evens, ...odds].map((value, i) => ({ id: idOffset + i, value, side }))
  }
  return [...buildParitySide(0, 'left'), ...buildParitySide(100, 'right')]
}

function generate(tier: Challenge500Tier) {
  const items = buildItems(tier)
  const slots: Slot[] = tier === 1 ? ['size'] : ['size', 'side']
  const maxSlots = slots.length as 1 | 2
  const invertCount = pickInversionCount(tier, maxSlots)
  const invertedSlots = new Set(shuffle(slots).slice(0, invertCount))

  const sizeWordShown = pickAxisWord('bigSmall')
  const sizeInverted = invertedSlots.has('size')
  const sizeWordEffective = sizeInverted ? opposite('bigSmall', sizeWordShown) : sizeWordShown
  const wantDescending = sizeWordEffective === '大きい'

  let sideWordShown: string | null = null
  let effectiveSide: 'left' | 'right' | null = null
  let sideInverted = false
  if (tier >= 2) {
    sideWordShown = pickAxisWord('leftRight')
    sideInverted = invertedSlots.has('side')
    const sideWordEffective = sideInverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }

  let pool = items
  if (effectiveSide) pool = pool.filter((it) => it.side === effectiveSide)
  if (tier === 3) pool = pool.filter((it) => it.value % 2 === 0)

  const sorted = [...pool].sort((a, b) => (wantDescending ? b.value - a.value : a.value - b.value))
  const order = sorted.slice(0, 3).map((it) => it.id)

  const segments: PromptSegment[] = []
  if (tier === 3) segments.push({ text: '偶数の中で、', inverted: false })
  if (sideWordShown) segments.push({ text: sideWordShown, inverted: sideInverted }, { text: 'にある', inverted: false })
  segments.push({ text: `${sizeWordShown}順に`, inverted: sizeInverted }, { text: '3つ押せ！', inverted: false })

  return { items, order, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { items, order, segments } = spec.data as { items: Item[]; order: number[]; segments: PromptSegment[] }
  const [clearedCount, setClearedCount] = useState(0)
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const [leftItems] = useState(() => items.filter((it) => it.side === 'left'))
  const [rightItems] = useState(() => items.filter((it) => it.side === 'right'))

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function tap(id: number) {
    if (!ready || doneRef.current) return
    const expected = order[clearedCount]
    if (id !== expected) {
      finish(false)
      return
    }
    const next = clearedCount + 1
    setClearedCount(next)
    if (next >= order.length) finish(true)
  }

  function renderButton(it: Item) {
    const tapped = order.slice(0, clearedCount).includes(it.id)
    return (
      <button
        key={it.id}
        onPointerDown={() => tap(it.id)}
        className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white active:scale-90 ${
          tapped ? 'bg-white/30' : 'bg-white/10'
        }`}
      >
        {it.value}
      </button>
    )
  }

  const hasSides = rightItems.length > 0
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      {hasSides ? (
        <div className="flex w-full max-w-xs items-start justify-between gap-6">
          <div className="grid grid-cols-2 gap-3">{leftItems.map(renderButton)}</div>
          <div className="grid grid-cols-2 gap-3">{rightItems.map(renderButton)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">{leftItems.map(renderButton)}</div>
      )}
    </div>
  )
}

export const SequenceRankChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500SequenceRank',
  generate,
  Component,
}
