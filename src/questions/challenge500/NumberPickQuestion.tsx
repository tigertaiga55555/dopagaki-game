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
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート1（数字選択）。
 *
 * ・tier1（200〜299%）：反転候補は「大きい/小さい」の1箇所のみ（maxSlots=1）。
 * ・tier2（300〜399%）：位置条件「左/右」を追加し、反転候補は最大2箇所（maxSlots=2）。
 * ・tier3（400〜499%）：反転しない通常条件「偶数の中で」を先頭に常に追加し、
 *   反転候補自体はtier2と同じ最大2箇所のまま（複合条件＋反転というtier3の性質は
 *   「常に2箇所反転」ではなく「通常条件＋0〜2箇所の反転」という形で表現する）。
 *
 * どの箇所を反転するか（0/1/2個）はpickInversionCountでtier別の比率から毎回抽選し、
 * 反転しなかった語は下線なし・文章どおりの意味として扱う（ユーザー指示の訂正：
 * 「毎問必ず反転」は禁止、反転なし問題を必ず混在させる）。
 *
 * 正解の一意性は「反転後に絞り込まれる候補集合内で、値が互いに重複しない」ことを
 * 生成時に構造的に保証することで担保する（invertCountの値に関わらず、どちらの側／
 * どちらの偶奇が選ばれても必ず一意のmax/minが存在する集合になるよう構築している）。
 */
function buildItems(tier: Challenge500Tier): Item[] {
  if (tier === 1) {
    const values = new Set<number>()
    while (values.size < 4) values.add(randInt(1, 50))
    return [...values].map((value, id) => ({ id, value, side: 'left' as const }))
  }
  if (tier === 2) {
    const values = new Set<number>()
    while (values.size < 4) values.add(randInt(1, 50))
    const [a, b, c, d] = [...values]
    return [
      { id: 0, value: a, side: 'left' },
      { id: 1, value: b, side: 'left' },
      { id: 2, value: c, side: 'right' },
      { id: 3, value: d, side: 'right' },
    ]
  }
  // tier3: 各サイド「偶数2個＋奇数2個」、値はすべて重複なし。
  const evens = new Set<number>()
  while (evens.size < 4) evens.add(randInt(1, 25) * 2)
  const odds = new Set<number>()
  while (odds.size < 4) odds.add(randInt(1, 25) * 2 - 1)
  const [e1, e2, e3, e4] = [...evens]
  const [o1, o2, o3, o4] = [...odds]
  return [
    { id: 0, value: e1, side: 'left' },
    { id: 1, value: e2, side: 'left' },
    { id: 2, value: o1, side: 'left' },
    { id: 3, value: o2, side: 'left' },
    { id: 4, value: e3, side: 'right' },
    { id: 5, value: e4, side: 'right' },
    { id: 6, value: o3, side: 'right' },
    { id: 7, value: o4, side: 'right' },
  ]
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
  const wantMax = sizeWordEffective === '大きい'

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

  const target = wantMax ? Math.max(...pool.map((it) => it.value)) : Math.min(...pool.map((it) => it.value))
  const targetId = pool.find((it) => it.value === target)!.id

  const segments: PromptSegment[] = []
  if (tier === 3) segments.push({ text: '偶数の中で、', inverted: false })
  if (sideWordShown) segments.push({ text: sideWordShown, inverted: sideInverted }, { text: 'にある', inverted: false })
  segments.push(
    { text: '一番 ', inverted: false },
    { text: sizeWordShown, inverted: sizeInverted },
    { text: ' 数字を押せ！', inverted: false },
  )

  return { items: shuffle(items), targetId, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { items, targetId, segments } = spec.data as { items: Item[]; targetId: number; segments: PromptSegment[] }
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const [leftItems] = useState(() => items.filter((it) => it.side === 'left'))
  const [rightItems] = useState(() => items.filter((it) => it.side === 'right'))

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function renderButton(it: Item) {
    return (
      <button
        key={it.id}
        onPointerDown={() => ready && finish(it.id === targetId)}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
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
        <div className="grid grid-cols-2 gap-4">{leftItems.map(renderButton)}</div>
      )}
    </div>
  )
}

export const NumberPickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500NumberPick',
  generate,
  Component,
}
