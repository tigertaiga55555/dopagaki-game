import { useRef, useState } from 'react'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { ShapeIcon, SHAPE_IDS, type ShapeId } from '../../components/ShapeIcon'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick, pickExcluding, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule, Challenge500Tier } from './types'

interface Item {
  id: number
  shape: ShapeId
  isOdd: boolean
}

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート7（除外・複数タップ問題）。
 * FINAL DOPA TRIALの「仲間外れ以外を全部押す」系問題（FinalExcludeOddOneOutQuestion等、
 * 既に色依存を排除済み）を、500%向けに下線反転と組み合わせて再利用する。
 *
 * sameDifferent軸（同じ/異なる）を使い、「形が[同じ/異なる]ものを全部押せ」という
 * 単一の文で両方向を表現する：
 * ・効果的な語が「同じ」→ main図形（お互いに同じ形）全部をタップするのが正解（複数タップ）。
 * ・効果的な語が「異なる」→ odd図形（他と異なる1個）だけをタップするのが正解（単発タップ）。
 * どちらの場合も正解集合は構造的に一意（main全部、またはodd1個のどちらかに必ず定まる）で、
 * 不正解図形を1回でもタップした時点で即MISSにする——間違った集合の図形を押す余地がない。
 *
 * ・tier1（200〜299%）：main4個＋odd1個（5択）。
 * ・tier2（300〜399%）：main5個＋odd1個（6択、タップすべき個数が増えて難化）。
 * ・tier3（400〜499%）：main5個＋odd1個のまま、タップ数の多さそのものが引き続き難度を担う
 *   （他テンプレートのような追加フィルタ条件はこのメカニクスには設けない）。
 */
function buildItems(tier: Challenge500Tier): Item[] {
  const mainShape = pick(SHAPE_IDS)
  const oddShape = pickExcluding(SHAPE_IDS, mainShape)
  const mainCount = tier === 1 ? 4 : 5
  const items: Item[] = Array.from({ length: mainCount }, (_, i) => ({ id: i, shape: mainShape, isOdd: false }))
  items.push({ id: mainCount, shape: oddShape, isOdd: true })
  return shuffle(items)
}

function generate(tier: Challenge500Tier) {
  const items = buildItems(tier)
  const sameWordShown = pickAxisWord('sameDifferent')
  const inverted = pickInversionCount(tier, 1) === 1
  const sameWordEffective = inverted ? opposite('sameDifferent', sameWordShown) : sameWordShown
  const wantSame = sameWordEffective === '同じ'

  const correctIds = new Set(wantSame ? items.filter((it) => !it.isOdd).map((it) => it.id) : items.filter((it) => it.isOdd).map((it) => it.id))

  const segments: PromptSegment[] = [{ text: `形が ${sameWordShown} `, inverted }, { text: 'ものを全部押せ！', inverted: false }]

  return { items, correctIds: [...correctIds], segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { items, correctIds, segments } = spec.data as { items: Item[]; correctIds: number[]; segments: PromptSegment[] }
  const correctSet = new Set(correctIds)
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const [tappedIds, setTappedIds] = useState<Set<number>>(new Set())

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function tap(id: number) {
    if (!ready || doneRef.current) return
    if (!correctSet.has(id)) {
      finish(false)
      return
    }
    const next = new Set(tappedIds)
    next.add(id)
    setTappedIds(next)
    if (next.size === correctSet.size) finish(true)
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-4 text-center select-none">
      <InversionPrompt segments={segments} />
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => tap(it.id)}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl p-2 active:scale-90 ${
              tappedIds.has(it.id) ? 'bg-white/30' : 'bg-white/10'
            }`}
          >
            <ShapeIcon shape={it.shape} size={32} />
          </button>
        ))}
      </div>
    </div>
  )
}

export const ExcludePickChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500ExcludePick',
  generate,
  Component,
}
