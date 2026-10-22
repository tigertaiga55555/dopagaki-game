import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { SequenceRankChallenge500Module } from './SequenceRankQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

interface Item {
  id: number
  value: number
  side: 'left' | 'right'
}

type Data = { items: Item[]; order: number[]; segments: PromptSegment[] }

const RUNS = 600

function deriveEffective(data: Data) {
  const sizeSeg = data.segments.find((s) => s.text.includes('大きい') || s.text.includes('小さい'))!
  const sizeWordShown = sizeSeg.text.includes('大きい') ? '大きい' : '小さい'
  const sizeWordEffective = sizeSeg.inverted ? opposite('bigSmall', sizeWordShown) : sizeWordShown
  const wantDescending = sizeWordEffective === '大きい'

  const sideSeg = data.segments.find((s) => s.text === '左' || s.text === '右')
  let effectiveSide: 'left' | 'right' | null = null
  if (sideSeg) {
    const sideWordShown = sideSeg.text as '左' | '右'
    const sideWordEffective = sideSeg.inverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }
  return { wantDescending, effectiveSide }
}

function expectedOrder(values: Item[], wantDescending: boolean): number[] {
  return [...values].sort((a, b) => (wantDescending ? b.value - a.value : a.value - b.value)).slice(0, 3).map((it) => it.id)
}

describe('SequenceRankQuestion (FINAL-derived ordered top-3 tap, inversion template)', () => {
  it('tier1: 6 distinct values; 0/1 inversion mix; order matches the re-derived top/bottom-3', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = SequenceRankChallenge500Module.generate(1) as Data
      expect(data.items).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const values = data.items.map((it) => it.value)
      expect(new Set(values).size).toBe(6)

      const { wantDescending } = deriveEffective(data)
      expect(data.order).toEqual(expectedOrder(data.items, wantDescending))
      expect(data.order).toHaveLength(3)
      expect(new Set(data.order).size).toBe(3)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: 6+6 per side; 0/1/2 inversion mix; order computed within the effective side only', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = SequenceRankChallenge500Module.generate(2) as Data
      expect(data.items).toHaveLength(12)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantDescending, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide)
      expect(pool).toHaveLength(6)
      expect(data.order).toEqual(expectedOrder(pool, wantDescending))
      for (const id of data.order) {
        expect(data.items.find((it) => it.id === id)!.side).toBe(effectiveSide)
      }
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: always has the non-inverted parity condition; order computed within effective side + evens only', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = SequenceRankChallenge500Module.generate(3) as Data
      expect(data.items).toHaveLength(12)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('偶数'))).toBe(true)

      const { wantDescending, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide && it.value % 2 === 0)
      expect(pool.length).toBeGreaterThanOrEqual(3)
      expect(data.order).toEqual(expectedOrder(pool, wantDescending))
      for (const id of data.order) {
        const item = data.items.find((it) => it.id === id)!
        expect(item.value % 2).toBe(0)
      }
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('every generated spec has an order of 3 ids that all exist in its own items array', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = SequenceRankChallenge500Module.generate(tier) as Data
        expect(data.order).toHaveLength(3)
        for (const id of data.order) {
          expect(data.items.some((it) => it.id === id)).toBe(true)
        }
      }
    }
  })
})
