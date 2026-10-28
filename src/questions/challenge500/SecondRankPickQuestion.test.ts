import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { SecondRankPickChallenge500Module } from './SecondRankPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

interface Item {
  id: number
  value: number
  side: 'left' | 'right'
}

type Data = { items: Item[]; targetId: number; segments: PromptSegment[] }

const RUNS = 600

function deriveEffective(data: Data) {
  const sizeSeg = data.segments.find((s) => s.text.includes('大きい') || s.text.includes('小さい'))!
  const sizeWordShown = sizeSeg.text.includes('大きい') ? '大きい' : '小さい'
  const sizeWordEffective = sizeSeg.inverted ? opposite('bigSmall', sizeWordShown) : sizeWordShown
  const wantSecondLargest = sizeWordEffective === '大きい'

  const sideSeg = data.segments.find((s) => s.text === '左' || s.text === '右')
  let effectiveSide: 'left' | 'right' | null = null
  if (sideSeg) {
    const sideWordShown = sideSeg.text as '左' | '右'
    const sideWordEffective = sideSeg.inverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }
  return { wantSecondLargest, effectiveSide }
}

function secondRankOf(values: number[], wantSecondLargest: boolean): number {
  const sorted = [...values].sort((a, b) => (wantSecondLargest ? b - a : a - b))
  return sorted[1]
}

describe('SecondRankPickQuestion (2nd-rank inversion template, FINAL-derived)', () => {
  it('tier1: 5 distinct values; 0/1 inversion mix; target is always the re-derived 2nd rank', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = SecondRankPickChallenge500Module.generate(1) as Data
      expect(data.items).toHaveLength(5)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const values = data.items.map((it) => it.value)
      expect(new Set(values).size).toBe(5)

      const { wantSecondLargest } = deriveEffective(data)
      const expected = secondRankOf(values, wantSecondLargest)
      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: 4+4 per side; 0/1/2 inversion mix; target matches the effective side', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = SecondRankPickChallenge500Module.generate(2) as Data
      expect(data.items).toHaveLength(8)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantSecondLargest, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide)
      expect(pool).toHaveLength(4)
      const values = pool.map((it) => it.value)
      expect(new Set(values).size).toBe(4)
      const expected = secondRankOf(values, wantSecondLargest)

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.side).toBe(effectiveSide)
      expect(target.value).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: each side guarantees 4 evens + 2 odds; 2nd rank among evens always well-defined', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = SecondRankPickChallenge500Module.generate(3) as Data
      expect(data.items).toHaveLength(12)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('偶数'))).toBe(true)

      const { wantSecondLargest, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide && it.value % 2 === 0)
      expect(pool).toHaveLength(4)
      const values = pool.map((it) => it.value)
      const expected = secondRankOf(values, wantSecondLargest)

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value % 2).toBe(0)
      expect(target.value).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('every generated spec has a target that exists in its own items array', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = SecondRankPickChallenge500Module.generate(tier) as Data
        expect(data.items.some((it) => it.id === data.targetId)).toBe(true)
      }
    }
  })
})
