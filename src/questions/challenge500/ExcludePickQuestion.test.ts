import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { ExcludePickChallenge500Module } from './ExcludePickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'
import type { ShapeId } from '../../components/ShapeIcon'

interface Item {
  id: number
  shape: ShapeId
  isOdd: boolean
}

type Data = { items: Item[]; correctIds: number[]; segments: PromptSegment[] }

const RUNS = 600

function deriveWantSame(data: Data) {
  const seg = data.segments[0]
  const sameWordShown = seg.text.includes('同じ') ? '同じ' : '異なる'
  const sameWordEffective = seg.inverted ? opposite('sameDifferent', sameWordShown) : sameWordShown
  return sameWordEffective === '同じ'
}

describe('ExcludePickQuestion (sameDifferent-axis multi-tap exclude template)', () => {
  it('tier1: 4 main + 1 odd (5 items); correctIds always matches either all-main or the-odd-one', () => {
    const seenInverted = new Set<boolean>()
    for (let i = 0; i < RUNS; i++) {
      const data = ExcludePickChallenge500Module.generate(1) as Data
      expect(data.items).toHaveLength(5)
      seenInverted.add(data.segments[0].inverted)

      const wantSame = deriveWantSame(data)
      const mainIds = data.items.filter((it) => !it.isOdd).map((it) => it.id)
      const oddIds = data.items.filter((it) => it.isOdd).map((it) => it.id)
      expect(mainIds).toHaveLength(4)
      expect(oddIds).toHaveLength(1)

      const expected = wantSame ? mainIds : oddIds
      expect(new Set(data.correctIds)).toEqual(new Set(expected))
    }
    expect(seenInverted.has(true)).toBe(true)
    expect(seenInverted.has(false)).toBe(true)
  })

  it('tier2/tier3: 5 main + 1 odd (6 items); correctIds always matches either all-main or the-odd-one', () => {
    for (const tier of [2, 3] as const) {
      for (let i = 0; i < RUNS; i++) {
        const data = ExcludePickChallenge500Module.generate(tier) as Data
        expect(data.items).toHaveLength(6)

        const wantSame = deriveWantSame(data)
        const mainIds = data.items.filter((it) => !it.isOdd).map((it) => it.id)
        const oddIds = data.items.filter((it) => it.isOdd).map((it) => it.id)
        expect(mainIds).toHaveLength(5)
        expect(oddIds).toHaveLength(1)

        const expected = wantSame ? mainIds : oddIds
        expect(new Set(data.correctIds)).toEqual(new Set(expected))
      }
    }
  })

  it('correctIds never contains a mix of both main and odd shapes (always exactly one of the two sets)', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 200; i++) {
        const data = ExcludePickChallenge500Module.generate(tier) as Data
        const correctShapes = new Set(data.items.filter((it) => data.correctIds.includes(it.id)).map((it) => it.isOdd))
        expect(correctShapes.size).toBe(1) // すべてisOdd=trueか、すべてisOdd=falseのどちらか一方だけ
      }
    }
  })
})
