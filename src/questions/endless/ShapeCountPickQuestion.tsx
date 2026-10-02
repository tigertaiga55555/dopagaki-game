import { useRef } from 'react'
import { ShapeIcon, SHAPE_IDS, SHAPE_LABELS, type ShapeId } from '../../components/ShapeIcon'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick, pickExcluding, randInt, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import type { EndlessQuestionComponentProps, EndlessQuestionModule, EndlessTier } from './types'

interface Group {
  id: number
  side: 'left' | 'right'
  icons: ShapeId[]
  /** tier3のみ：数えるべき対象図形の個数（icons内のtargetShape出現数） */
  targetCount?: number
}

/**
 * Ver.6 Phase 1: 下線反転ギミックのテンプレート2（図形グループの個数比較）。
 *
 * ・tier1（200〜299%）：「一番 [多い/少ない] グループを選べ」の1箇所反転のみ。
 * ・tier2（300〜399%）：位置条件「[左/右]にある」を追加し、2箇所反転にする。
 * ・tier3（400〜499%）：反転しない通常条件「○の図形だけを数えて」を追加し、
 *   通常条件（対象図形の指定）＋2つの反転条件という複合判断にする。
 *
 * 各グループの（対象図形の）個数は必ず重複しないよう構造的に生成するため、
 * 反転後の絞り込み後も同率1位が発生し得ない。
 */
function buildGroups(tier: EndlessTier): { groups: Group[]; targetShape?: ShapeId } {
  if (tier === 1) {
    const shape = pick(SHAPE_IDS)
    const counts = shuffle([2, 3, 4, 5])
    return { groups: counts.map((n, id) => ({ id, side: 'left' as const, icons: Array(n).fill(shape) })) }
  }
  if (tier === 2) {
    const shape = pick(SHAPE_IDS)
    const counts = shuffle([2, 3, 4, 5])
    return {
      groups: [
        { id: 0, side: 'left', icons: Array(counts[0]).fill(shape) },
        { id: 1, side: 'left', icons: Array(counts[1]).fill(shape) },
        { id: 2, side: 'right', icons: Array(counts[2]).fill(shape) },
        { id: 3, side: 'right', icons: Array(counts[3]).fill(shape) },
      ],
    }
  }
  // tier3: 各グループは対象図形＋ディストラクター図形の混合。対象図形の個数だけが判断材料。
  const targetShape = pick(SHAPE_IDS)
  const counts = shuffle([1, 2, 3, 4])
  const groups: Group[] = counts.map((targetCount, i) => {
    const side: 'left' | 'right' = i < 2 ? 'left' : 'right'
    const distractorCount = randInt(1, 3)
    const icons = shuffle([
      ...Array(targetCount).fill(targetShape),
      ...Array.from({ length: distractorCount }, () => pickExcluding(SHAPE_IDS, targetShape)),
    ])
    return { id: i, side, icons, targetCount }
  })
  return { groups, targetShape }
}

function generate(tier: EndlessTier) {
  const { groups, targetShape } = buildGroups(tier)
  const countWordShown = pickAxisWord('manyFew')
  const countWordEffective = opposite('manyFew', countWordShown)
  const wantMost = countWordEffective === '多い'

  let sideWordShown: string | null = null
  let effectiveSide: 'left' | 'right' | null = null
  if (tier >= 2) {
    sideWordShown = pickAxisWord('leftRight')
    effectiveSide = opposite('leftRight', sideWordShown) === '左' ? 'left' : 'right'
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
  if (sideWordShown) segments.push({ text: sideWordShown, inverted: true }, { text: 'にある', inverted: false })
  segments.push({ text: `一番 ${countWordShown} `, inverted: true }, { text: 'グループを選べ！', inverted: false })

  return { groups: shuffle(groups), targetId, segments }
}

function Component({ spec, onResult }: EndlessQuestionComponentProps) {
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
          <ShapeIcon key={i} shape={s} size={18} />
        ))}
      </button>
    )
  }

  const hasSides = rightGroups.length > 0
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      {hasSides ? (
        <div className="flex w-full max-w-xs items-start justify-between gap-6">
          <div className="flex flex-col gap-3">{leftGroups.map(renderGroup)}</div>
          <div className="flex flex-col gap-3">{rightGroups.map(renderGroup)}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">{leftGroups.map(renderGroup)}</div>
      )}
    </div>
  )
}

export const ShapeCountPickEndlessModule: EndlessQuestionModule = {
  id: 'endlessShapeCountPick',
  generate,
  Component,
}
