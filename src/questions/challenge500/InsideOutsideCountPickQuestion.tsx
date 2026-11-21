import { useRef } from 'react'
import { SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { ShapeGroupButton, ShapeOptionsGrid, ShapeOptionsTwoColumns } from '../../components/ShapeOptionsLayout'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick, pickExcluding, randInt, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule, Challenge500Tier } from './types'

interface Group {
  id: number
  zone: 'inside' | 'outside'
  icons: ShapeId[]
  targetCount?: number
}

type Slot = 'count' | 'zone'

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート5（内側/外側グループの個数比較）。
 * ShapeCountPickQuestionの「左右」をinsideOutside軸に置き換えた変種——軸が変わると
 * 判断の種類も変わる（左右は水平位置、内側/外側は入れ子構造の判断）ため、見た目が似ていても
 * 別の「系統」として扱う。
 *
 * ・tier1（200〜299%）：反転候補は「多い/少ない」の1箇所のみ。
 * ・tier2（300〜399%）：位置条件「内側/外側」を追加し、反転候補は最大2箇所。
 * ・tier3（400〜499%）：反転しない通常条件「○の図形だけを数えて」を常に追加する。
 *
 * 内側ゾーンは画面中央の枠内、外側ゾーンはその枠を囲む周囲に配置して視覚的に区別する
 * （色には依存しない——枠線の有無という形で示す）。各ゾーン内のグループ個数は、
 * 比較が行われる範囲の中で必ず重複しないよう構造的に生成する。
 */
function buildGroups(tier: Challenge500Tier): { groups: Group[]; targetShape?: ShapeId } {
  if (tier === 1) {
    const shape = pick(SHAPE_IDS)
    const counts = shuffle([2, 3, 4, 5, 6]).slice(0, 4)
    return { groups: counts.map((n, id) => ({ id, zone: 'inside' as const, icons: Array(n).fill(shape) })) }
  }
  const shape = tier === 2 ? pick(SHAPE_IDS) : undefined
  const targetShape = tier === 3 ? pick(SHAPE_IDS) : undefined
  const insideCounts = shuffle([1, 2, 3, 4, 5]).slice(0, 3)
  const outsideCounts = shuffle([1, 2, 3, 4, 5]).slice(0, 3)

  function buildZoneGroups(counts: number[], zone: 'inside' | 'outside', idOffset: number): Group[] {
    return counts.map((n, i) => {
      if (tier === 2) return { id: idOffset + i, zone, icons: Array(n).fill(shape) }
      const distractorCount = randInt(1, 3)
      const icons = shuffle([
        ...Array(n).fill(targetShape),
        ...Array.from({ length: distractorCount }, () => pickExcluding(SHAPE_IDS, targetShape)),
      ])
      return { id: idOffset + i, zone, icons, targetCount: n }
    })
  }
  const groups = [...buildZoneGroups(insideCounts, 'inside', 0), ...buildZoneGroups(outsideCounts, 'outside', 3)]
  return { groups, targetShape }
}

function generate(tier: Challenge500Tier) {
  const { groups, targetShape } = buildGroups(tier)
  const slots: Slot[] = tier === 1 ? ['count'] : ['count', 'zone']
  const maxSlots = slots.length as 1 | 2
  const invertCount = pickInversionCount(tier, maxSlots)
  const invertedSlots = new Set(shuffle(slots).slice(0, invertCount))

  const countWordShown = pickAxisWord('manyFew')
  const countInverted = invertedSlots.has('count')
  const countWordEffective = countInverted ? opposite('manyFew', countWordShown) : countWordShown
  const wantMost = countWordEffective === '多い'

  let zoneWordShown: string | null = null
  let effectiveZone: 'inside' | 'outside' | null = null
  let zoneInverted = false
  if (tier >= 2) {
    zoneWordShown = pickAxisWord('insideOutside')
    zoneInverted = invertedSlots.has('zone')
    const zoneWordEffective = zoneInverted ? opposite('insideOutside', zoneWordShown) : zoneWordShown
    effectiveZone = zoneWordEffective === '内側' ? 'inside' : 'outside'
  }

  let pool = groups
  if (effectiveZone) pool = pool.filter((g) => g.zone === effectiveZone)

  function countOf(g: Group) {
    return tier === 3 ? g.targetCount! : g.icons.length
  }

  const target = wantMost ? Math.max(...pool.map(countOf)) : Math.min(...pool.map(countOf))
  const targetId = pool.find((g) => countOf(g) === target)!.id

  const segments: PromptSegment[] = []
  if (tier === 3 && targetShape) segments.push({ text: `${SHAPE_LABELS[targetShape]}の図形だけを数えて、`, inverted: false })
  if (zoneWordShown) segments.push({ text: zoneWordShown, inverted: zoneInverted }, { text: 'のグループの中で、', inverted: false })
  segments.push(
    { text: '一番 ', inverted: false },
    { text: countWordShown, inverted: countInverted },
    { text: ' グループを選べ！', inverted: false },
  )

  return { groups: shuffle(groups), targetId, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { groups, targetId, segments } = spec.data as { groups: Group[]; targetId: number; segments: PromptSegment[] }
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const insideGroups = groups.filter((g) => g.zone === 'inside')
  const outsideGroups = groups.filter((g) => g.zone === 'outside')

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function renderGroup(g: Group) {
    return <ShapeGroupButton key={g.id} icons={g.icons} onPointerDown={() => ready && finish(g.id === targetId)} />
  }

  const hasZones = outsideGroups.length > 0
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      {hasZones ? (
        <ShapeOptionsTwoColumns
          left={outsideGroups.map(renderGroup)}
          right={
            <div className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-white/40 p-2">
              {insideGroups.map(renderGroup)}
            </div>
          }
        />
      ) : (
        <ShapeOptionsGrid columns={2}>{insideGroups.map(renderGroup)}</ShapeOptionsGrid>
      )}
    </div>
  )
}

export const InsideOutsideCountPickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500InsideOutsideCountPick',
  generate,
  Component,
}
