import { useRef, useState } from 'react'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { randInt, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule, Challenge500Tier } from './types'

interface Item {
  id: number
  widthPx: number
  side: 'left' | 'right'
}

type Slot = 'length' | 'side'

const MIN_WIDTH = 40
const MAX_WIDTH_SINGLE = 220
const MAX_WIDTH_SPLIT = 130
const MIN_GAP = 14

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート6（棒の長さ比較）。
 * NumberPickQuestionと同じ「大小比較」の構造だが、判断対象が「読んで理解する数字」
 * ではなく「見て比較する棒の長さ」であるため、求められる処理の種類が異なる
 * （視覚的な量の比較 vs 数値の読解）。
 *
 * ・tier1（200〜299%）：反転候補は「長い/短い」の1箇所のみ。
 * ・tier2（300〜399%）：位置条件「左/右」を追加し、反転候補は最大2箇所。
 * ・tier3（400〜499%）：反転しない通常条件「太い枠の棒だけを比べて」を常に追加する
 *   （枠線の太さという形・線の違いで示す、色には依存しない）。
 *
 * 各棒の幅は、比較が行われる範囲の中で必ず十分な差（MIN_GAP px以上）を持つよう
 * 構造的に生成するため、見た目で判別できないほど近い長さの組が生成されない。
 */
function buildDistinctWidths(count: number, maxWidth: number): number[] {
  const widths: number[] = []
  let guard = 0
  while (widths.length < count && guard < 500) {
    guard++
    const candidate = randInt(MIN_WIDTH, maxWidth)
    if (widths.every((w) => Math.abs(w - candidate) >= MIN_GAP)) widths.push(candidate)
  }
  while (widths.length < count) widths.push(MIN_WIDTH + widths.length * MIN_GAP * 2)
  return widths
}

function buildItems(tier: Challenge500Tier): { items: Item[]; thickIds: Set<number> } {
  if (tier === 1) {
    const widths = buildDistinctWidths(5, MAX_WIDTH_SINGLE)
    return { items: widths.map((widthPx, id) => ({ id, widthPx, side: 'left' as const })), thickIds: new Set() }
  }
  const leftWidths = buildDistinctWidths(3, MAX_WIDTH_SPLIT)
  const rightWidths = buildDistinctWidths(3, MAX_WIDTH_SPLIT)
  const items: Item[] = [
    ...leftWidths.map((widthPx, i) => ({ id: i, widthPx, side: 'left' as const })),
    ...rightWidths.map((widthPx, i) => ({ id: i + 100, widthPx, side: 'right' as const })),
  ]
  if (tier !== 3) return { items, thickIds: new Set() }
  // tier3: 各サイドにつき2本だけを「太い枠」に指定する（枠の太さ＝非反転の通常条件の対象）。
  const thickIds = new Set<number>()
  shuffle(items.filter((it) => it.side === 'left')).slice(0, 2).forEach((it) => thickIds.add(it.id))
  shuffle(items.filter((it) => it.side === 'right')).slice(0, 2).forEach((it) => thickIds.add(it.id))
  return { items, thickIds }
}

function generate(tier: Challenge500Tier) {
  const { items, thickIds } = buildItems(tier)
  const slots: Slot[] = tier === 1 ? ['length'] : ['length', 'side']
  const maxSlots = slots.length as 1 | 2
  const invertCount = pickInversionCount(tier, maxSlots)
  const invertedSlots = new Set(shuffle(slots).slice(0, invertCount))

  const lengthWordShown = pickAxisWord('longShort')
  const lengthInverted = invertedSlots.has('length')
  const lengthWordEffective = lengthInverted ? opposite('longShort', lengthWordShown) : lengthWordShown
  const wantLongest = lengthWordEffective === '長い'

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
  if (tier === 3) pool = pool.filter((it) => thickIds.has(it.id))

  const target = wantLongest ? Math.max(...pool.map((it) => it.widthPx)) : Math.min(...pool.map((it) => it.widthPx))
  const targetId = pool.find((it) => it.widthPx === target)!.id

  const segments: PromptSegment[] = []
  if (tier === 3) segments.push({ text: '太い枠の棒だけを比べて、', inverted: false })
  if (sideWordShown) segments.push({ text: sideWordShown, inverted: sideInverted }, { text: 'にある', inverted: false })
  segments.push(
    { text: '一番 ', inverted: false },
    { text: lengthWordShown, inverted: lengthInverted },
    { text: ' 棒を押せ！', inverted: false },
  )

  return { items, targetId, segments, thickIds: [...thickIds] }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { items, targetId, segments, thickIds } = spec.data as {
    items: Item[]
    targetId: number
    segments: PromptSegment[]
    thickIds: number[]
  }
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const thickSet = new Set(thickIds)
  const [leftItems] = useState(() => items.filter((it) => it.side === 'left'))
  const [rightItems] = useState(() => items.filter((it) => it.side === 'right'))

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function renderBar(it: Item) {
    const isThick = thickSet.has(it.id)
    return (
      <button
        key={it.id}
        onPointerDown={() => ready && finish(it.id === targetId)}
        className="flex h-10 items-center rounded-full bg-fuchsia-300/80 active:scale-95"
        style={{ width: `${it.widthPx}px`, border: isThick ? '4px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.3)' }}
      />
    )
  }

  const hasSides = rightItems.length > 0
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      {hasSides ? (
        <div className="flex w-full max-w-sm items-start justify-between gap-4">
          <div className="flex flex-col items-start gap-2.5">{leftItems.map(renderBar)}</div>
          <div className="flex flex-col items-end gap-2.5">{rightItems.map(renderBar)}</div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 pl-2">{leftItems.map(renderBar)}</div>
      )}
    </div>
  )
}

export const LengthPickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500LengthPick',
  generate,
  Component,
}
