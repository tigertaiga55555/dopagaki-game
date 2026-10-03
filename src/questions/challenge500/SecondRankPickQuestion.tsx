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
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート8（2番目の順位選択）。
 * FINAL DOPA TRIALの「2番目に大きい/小さい数字」系問題（FinalSecondLargestQuestion/
 * FinalSecondSmallestQuestion、元々色依存なし）を500%向けに下線反転と組み合わせて再利用。
 * NumberPickQuestionと構造はほぼ同じだが、正解が「1位の値」ではなく「2位の値
 * （sort結果の2番目）」になる点が異なり、1段階分の追加読解（「1位ではなく2位」）を要求する。
 *
 * ・tier1（200〜299%）：反転候補は「大きい/小さい」の1箇所のみ。5個中distinctな値から
 *   2番目の大小を選ぶ。
 * ・tier2（300〜399%）：位置条件「左/右」を追加し、反転候補は最大2箇所。各サイド4個。
 * ・tier3（400〜499%）：反転しない通常条件「偶数の中で」を常に追加する。各サイド
 *   偶数4個＋奇数2個を保証し、フィルタ後も2位が必ず定まる。
 */
function buildItems(tier: Challenge500Tier): Item[] {
  if (tier === 1) {
    const values = new Set<number>()
    while (values.size < 5) values.add(randInt(1, 99))
    return [...values].map((value, id) => ({ id, value, side: 'left' as const }))
  }
  if (tier === 2) {
    const leftValues = new Set<number>()
    while (leftValues.size < 4) leftValues.add(randInt(1, 99))
    const rightValues = new Set<number>()
    while (rightValues.size < 4) rightValues.add(randInt(1, 99))
    return [
      ...[...leftValues].map((value, i) => ({ id: i, value, side: 'left' as const })),
      ...[...rightValues].map((value, i) => ({ id: i + 100, value, side: 'right' as const })),
    ]
  }
  // tier3: 各サイド偶数4個＋奇数2個（偶数だけに絞っても2位が必ず定まるようにするため）。
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
  const wantSecondLargest = sizeWordEffective === '大きい'

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

  const sorted = [...pool].sort((a, b) => (wantSecondLargest ? b.value - a.value : a.value - b.value))
  const targetId = sorted[1].id

  const segments: PromptSegment[] = []
  if (tier === 3) segments.push({ text: '偶数の中で、', inverted: false })
  if (sideWordShown) segments.push({ text: sideWordShown, inverted: sideInverted }, { text: 'にある', inverted: false })
  segments.push({ text: `2番目に ${sizeWordShown} `, inverted: sizeInverted }, { text: '数字を押せ！', inverted: false })

  return { items, targetId, segments }
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
        <div className="grid grid-cols-3 gap-3">{leftItems.map(renderButton)}</div>
      )}
    </div>
  )
}

export const SecondRankPickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500SecondRankPick',
  generate,
  Component,
}
