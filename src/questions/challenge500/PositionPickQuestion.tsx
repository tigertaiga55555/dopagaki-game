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
  row: 'top' | 'bottom'
  /** 行内での並び順（0始まり）。位置判定（最初/最後）は必ずこのorderで行う（表示もこの順を保つ）。 */
  order: number
}

type Slot = 'position' | 'row'

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート4（並び位置選択）。
 * NumberPickQuestionが「数の大小」で正解を決めるのに対し、本テンプレートは
 * 「並び順の中での位置（最初/最後）」で正解を決める——軸が異なるため、同じ画面に
 * 数字が並んでいても要求される判断の種類が変わる（ユーザー指示: 問題タイプの複雑さで
 * 難易度を作る）。
 *
 * ・tier1（200〜299%）：反転候補は「最初/最後」の1箇所のみ（maxSlots=1）。各行の並び順
 *   （order）は固定で、シャッフルしない（位置の意味が崩れるため）。
 * ・tier2（300〜399%）：位置条件「上/下」（どの行を見るか）を追加し、反転候補は最大2箇所。
 *   実機フィードバック修正: 本テンプレートの実際のレイアウトは上下2段に積んだ行であり、
 *   左右に並ぶ列ではないため、軸はleftRightではなくupDownを使う（「右の行」のような、
 *   画面構造と日本語が一致しない問題文を防ぐ）。
 * ・tier3（400〜499%）：反転しない通常条件「偶数の数字だけを数えて」を常に追加する
 *   （奇数を除いた残りの並び順で最初/最後を判定する）。
 *
 * 正解の一意性は「対象となる行（＝必ず1行）の中で最初/最後の要素は常に1つに決まる」
 * という構造（配列のインデックス自体が正解を決める）で保証する。
 */
/** 通常の行：distinct値だけ保証（値の偶奇は問わない）。 */
function buildPlainRow(length: number): number[] {
  const values = new Set<number>()
  while (values.size < length) values.add(randInt(1, 99))
  return [...values]
}

/**
 * tier3専用の行：偶数3個＋奇数3個を必ず含むよう構造的に保証したうえでシャッフルする。
 * 「偶数だけを数えて」フィルタ後も必ず複数の候補が残ることを生成時に保証するため
 * （ランダムにゼロ件になり得る素朴なrandInt方式は使わない）。
 */
function buildParityMixedRow(): number[] {
  const evens = new Set<number>()
  while (evens.size < 3) evens.add(randInt(1, 49) * 2)
  const odds = new Set<number>()
  while (odds.size < 3) odds.add(randInt(1, 49) * 2 - 1)
  return shuffle([...evens, ...odds])
}

function toRow(values: number[], idOffset: number, row: 'top' | 'bottom'): Item[] {
  return values.map((value, order) => ({ id: idOffset + order, value, row, order }))
}

function buildItems(tier: Challenge500Tier): Item[] {
  if (tier === 1) {
    return toRow(buildPlainRow(5), 0, 'top')
  }
  const buildRowValues = tier === 3 ? buildParityMixedRow : () => buildPlainRow(5)
  const topRow = toRow(buildRowValues(), 0, 'top')
  const bottomRow = toRow(buildRowValues(), 100, 'bottom')
  return [...topRow, ...bottomRow]
}

function generate(tier: Challenge500Tier) {
  const items = buildItems(tier)
  const slots: Slot[] = tier === 1 ? ['position'] : ['position', 'row']
  const maxSlots = slots.length as 1 | 2
  const invertCount = pickInversionCount(tier, maxSlots)
  const invertedSlots = new Set(shuffle(slots).slice(0, invertCount))

  const posWordShown = pickAxisWord('firstLast')
  const posInverted = invertedSlots.has('position')
  const posWordEffective = posInverted ? opposite('firstLast', posWordShown) : posWordShown
  const wantFirst = posWordEffective === '最初'

  let rowWordShown: string | null = null
  let effectiveRow: 'top' | 'bottom' | null = null
  let rowInverted = false
  if (tier >= 2) {
    rowWordShown = pickAxisWord('upDown')
    rowInverted = invertedSlots.has('row')
    const rowWordEffective = rowInverted ? opposite('upDown', rowWordShown) : rowWordShown
    effectiveRow = rowWordEffective === '上' ? 'top' : 'bottom'
  }

  let row = effectiveRow ? items.filter((it) => it.row === effectiveRow) : items
  row = [...row].sort((a, b) => a.order - b.order)
  if (tier === 3) row = row.filter((it) => it.value % 2 === 0)

  const target = wantFirst ? row[0] : row[row.length - 1]

  const segments: PromptSegment[] = []
  if (tier === 3) segments.push({ text: '偶数の数字だけを数えて、', inverted: false })
  if (rowWordShown) segments.push({ text: rowWordShown, inverted: rowInverted }, { text: 'の行の', inverted: false })
  segments.push({ text: posWordShown, inverted: posInverted }, { text: ' にある数字を押せ！', inverted: false })

  return { items, targetId: target.id, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { items, targetId, segments } = spec.data as { items: Item[]; targetId: number; segments: PromptSegment[] }
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const [topRow] = useState(() => items.filter((it) => it.row === 'top').sort((a, b) => a.order - b.order))
  const [bottomRow] = useState(() => items.filter((it) => it.row === 'bottom').sort((a, b) => a.order - b.order))

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
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white active:scale-90"
      >
        {it.value}
      </button>
    )
  }

  const hasRows = bottomRow.length > 0
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      {hasRows ? (
        <div className="flex w-full flex-col gap-4">
          <div className="flex justify-center gap-2">{topRow.map(renderButton)}</div>
          <div className="flex justify-center gap-2">{bottomRow.map(renderButton)}</div>
        </div>
      ) : (
        <div className="flex justify-center gap-2.5">{topRow.map(renderButton)}</div>
      )}
    </div>
  )
}

export const PositionPickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500PositionPick',
  generate,
  Component,
}
