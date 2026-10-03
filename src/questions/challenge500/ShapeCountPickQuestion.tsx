import { useRef } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick, pickExcluding, randInt, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule, Challenge500Tier } from './types'

interface Group {
  id: number
  side: 'left' | 'right'
  icons: ShapeId[]
  /** tier3のみ：数えるべき対象図形の個数（icons内のtargetShape出現数） */
  targetCount?: number
}

type Slot = 'count' | 'side'

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート2（図形グループの個数比較）。
 *
 * 単純な4択では実機上簡単すぎるため、選択肢を6グループに増やす（tier1は2×3グリッド、
 * tier2/3は左右3グループずつ）。
 *
 * ・tier1（200〜299%）：反転候補は「多い/少ない」の1箇所のみ（maxSlots=1）。
 * ・tier2（300〜399%）：位置条件「左/右」を追加し、反転候補は最大2箇所（maxSlots=2）。
 * ・tier3（400〜499%）：反転しない通常条件「○の図形だけを数えて」を常に追加する
 *   （反転候補自体はtier2と同じ最大2箇所のまま）。
 *
 * どの箇所を反転するか（0/1/2個）はpickInversionCountで毎回抽選し、反転しなかった語は
 * 下線なし・文章どおりの意味として扱う（反転なし問題を必ず混在させる）。
 *
 * 各グループの（対象図形の）個数は、比較が行われる範囲（tier1は全6グループ、tier2/3は
 * フィルタ後の片側3グループ）の中で必ず重複しないよう構造的に生成するため、反転の有無に
 * 関わらず同率1位が発生し得ない。
 */
function buildGroups(tier: Challenge500Tier): { groups: Group[]; targetShape?: ShapeId } {
  if (tier === 1) {
    const shape = pick(SHAPE_IDS)
    const counts = shuffle([2, 3, 4, 5, 6, 7])
    return { groups: counts.map((n, id) => ({ id, side: 'left' as const, icons: Array(n).fill(shape) })) }
  }
  if (tier === 2) {
    const shape = pick(SHAPE_IDS)
    const leftCounts = shuffle([2, 3, 4, 5, 6, 7]).slice(0, 3)
    const rightCounts = shuffle([2, 3, 4, 5, 6, 7]).slice(0, 3)
    const groups: Group[] = [
      ...leftCounts.map((n, i) => ({ id: i, side: 'left' as const, icons: Array(n).fill(shape) })),
      ...rightCounts.map((n, i) => ({ id: i + 3, side: 'right' as const, icons: Array(n).fill(shape) })),
    ]
    return { groups }
  }
  // tier3: 各グループは対象図形＋ディストラクター図形の混合。対象図形の個数だけが判断材料。
  const targetShape = pick(SHAPE_IDS)
  const leftCounts = shuffle([1, 2, 3, 4, 5]).slice(0, 3)
  const rightCounts = shuffle([1, 2, 3, 4, 5]).slice(0, 3)
  function buildSideGroups(counts: number[], side: 'left' | 'right', idOffset: number): Group[] {
    return counts.map((targetCount, i) => {
      const distractorCount = randInt(1, 3)
      const icons = shuffle([
        ...Array(targetCount).fill(targetShape),
        ...Array.from({ length: distractorCount }, () => pickExcluding(SHAPE_IDS, targetShape)),
      ])
      return { id: idOffset + i, side, icons, targetCount }
    })
  }
  const groups = [...buildSideGroups(leftCounts, 'left', 0), ...buildSideGroups(rightCounts, 'right', 3)]
  return { groups, targetShape }
}

function generate(tier: Challenge500Tier) {
  const { groups, targetShape } = buildGroups(tier)
  const slots: Slot[] = tier === 1 ? ['count'] : ['count', 'side']
  const maxSlots = slots.length as 1 | 2
  const invertCount = pickInversionCount(tier, maxSlots)
  const invertedSlots = new Set(shuffle(slots).slice(0, invertCount))

  const countWordShown = pickAxisWord('manyFew')
  const countInverted = invertedSlots.has('count')
  const countWordEffective = countInverted ? opposite('manyFew', countWordShown) : countWordShown
  const wantMost = countWordEffective === '多い'

  let sideWordShown: string | null = null
  let effectiveSide: 'left' | 'right' | null = null
  let sideInverted = false
  if (tier >= 2) {
    sideWordShown = pickAxisWord('leftRight')
    sideInverted = invertedSlots.has('side')
    const sideWordEffective = sideInverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }

  let pool = groups
  if (effectiveSide) pool = pool.filter((g) => g.side === effectiveSide)

  function countOf(g: Group) {
    return tier === 3 ? g.targetCount! : g.icons.length
  }

  const target = wantMost ? Math.max(...pool.map(countOf)) : Math.min(...pool.map(countOf))
  const targetId = pool.find((g) => countOf(g) === target)!.id

  const segments: PromptSegment[] = []
  if (tier === 3 && targetShape) segments.push({ text: `${SHAPE_LABELS[targetShape]}の図形だけを数えて、`, inverted: false })
  if (sideWordShown) segments.push({ text: sideWordShown, inverted: sideInverted }, { text: 'にある', inverted: false })
  segments.push({ text: `一番 ${countWordShown} `, inverted: countInverted }, { text: 'グループを選べ！', inverted: false })

  return { groups: shuffle(groups), targetId, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { groups, targetId, segments } = spec.data as { groups: Group[]; targetId: number; segments: PromptSegment[] }
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const leftGroups = groups.filter((g) => g.side === 'left')
  const rightGroups = groups.filter((g) => g.side === 'right')

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function renderGroup(g: Group) {
    return (
      <button
        key={g.id}
        onPointerDown={() => ready && finish(g.id === targetId)}
        className="flex min-h-16 min-w-20 flex-wrap items-center justify-center gap-1 rounded-2xl bg-white/10 p-2 active:scale-90"
      >
        {g.icons.map((s, i) => (
          <ShapeIcon key={i} shape={s} size={16} />
        ))}
      </button>
    )
  }

  const hasSides = rightGroups.length > 0
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      {hasSides ? (
        <div className="flex w-full max-w-xs items-start justify-between gap-6">
          <div className="grid grid-cols-1 gap-2.5">{leftGroups.map(renderGroup)}</div>
          <div className="grid grid-cols-1 gap-2.5">{rightGroups.map(renderGroup)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">{leftGroups.map(renderGroup)}</div>
      )}
    </div>
  )
}

export const ShapeCountPickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500ShapeCountPick',
  generate,
  Component,
}
