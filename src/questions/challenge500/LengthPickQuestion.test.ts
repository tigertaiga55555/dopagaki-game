import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { LengthPickChallenge500Module } from './LengthPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

interface Item {
  id: number
  widthPx: number
  side: 'left' | 'right'
}

type Data = { items: Item[]; targetId: number; segments: PromptSegment[]; thickIds: number[] }

const RUNS = 600

function deriveEffective(data: Data) {
  const lenSeg = data.segments.find((s) => s.text.includes('長い') || s.text.includes('短い'))!
  const lenWordShown = lenSeg.text.includes('長い') ? '長い' : '短い'
  const lenWordEffective = lenSeg.inverted ? opposite('longShort', lenWordShown) : lenWordShown
  const wantLongest = lenWordEffective === '長い'

  const sideSeg = data.segments.find((s) => s.text === '左' || s.text === '右')
  let effectiveSide: 'left' | 'right' | null = null
  if (sideSeg) {
    const sideWordShown = sideSeg.text as '左' | '右'
    const sideWordEffective = sideSeg.inverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }
  return { wantLongest, effectiveSide }
}

describe('LengthPickQuestion (longShort-axis bar-length inversion template)', () => {
  it('tier1: 5 distinct-width bars (min gap enforced); 0/1 inversion mix; target matches re-derived extremum', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = LengthPickChallenge500Module.generate(1) as Data
      expect(data.items).toHaveLength(5)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const widths = data.items.map((it) => it.widthPx)
      expect(new Set(widths).size).toBe(widths.length)

      const { wantLongest } = deriveEffective(data)
      const expected = wantLongest ? Math.max(...widths) : Math.min(...widths)
      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.widthPx).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: 3+3 bars per side; 0/1/2 inversion mix; target matches the effective side', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = LengthPickChallenge500Module.generate(2) as Data
      expect(data.items).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantLongest, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide)
      expect(pool).toHaveLength(3)
      const widths = pool.map((it) => it.widthPx)
      expect(new Set(widths).size).toBe(3)
      const expected = wantLongest ? Math.max(...widths) : Math.min(...widths)

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.side).toBe(effectiveSide)
      expect(target.widthPx).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: exactly 2 "thick" bars per side (non-inverted filter), always non-empty after filtering', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = LengthPickChallenge500Module.generate(3) as Data
      expect(data.items).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('太い枠'))).toBe(true)
      expect(data.thickIds.length).toBe(4) // 2 per side

      const { wantLongest, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const thickSet = new Set(data.thickIds)
      const pool = data.items.filter((it) => it.side === effectiveSide && thickSet.has(it.id))
      expect(pool).toHaveLength(2)
      const widths = pool.map((it) => it.widthPx)
      const expected = wantLongest ? Math.max(...widths) : Math.min(...widths)

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(thickSet.has(target.id)).toBe(true)
      expect(target.widthPx).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('every generated spec has a target that exists in its own items array', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = LengthPickChallenge500Module.generate(tier) as Data
        expect(data.items.some((it) => it.id === data.targetId)).toBe(true)
      }
    }
  })
})
