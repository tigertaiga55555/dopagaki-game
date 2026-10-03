import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { InsideOutsideCountPickChallenge500Module } from './InsideOutsideCountPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'
import type { ShapeId } from '../../components/ShapeIcon'

interface Group {
  id: number
  zone: 'inside' | 'outside'
  icons: ShapeId[]
  targetCount?: number
}

type Data = { groups: Group[]; targetId: number; segments: PromptSegment[] }

const RUNS = 600

function deriveEffective(data: Data) {
  const countSeg = data.segments.find((s) => s.text.includes('多い') || s.text.includes('少ない'))!
  const countWordShown = countSeg.text.includes('多い') ? '多い' : '少ない'
  const countWordEffective = countSeg.inverted ? opposite('manyFew', countWordShown) : countWordShown
  const wantMost = countWordEffective === '多い'

  const zoneSeg = data.segments.find((s) => s.text === '内側' || s.text === '外側')
  let effectiveZone: 'inside' | 'outside' | null = null
  if (zoneSeg) {
    const zoneWordShown = zoneSeg.text as '内側' | '外側'
    const zoneWordEffective = zoneSeg.inverted ? opposite('insideOutside', zoneWordShown) : zoneWordShown
    effectiveZone = zoneWordEffective === '内側' ? 'inside' : 'outside'
  }
  return { wantMost, effectiveZone }
}

describe('InsideOutsideCountPickQuestion (insideOutside-axis inversion template)', () => {
  it('tier1: 4 distinct-count groups, all inside zone; 0/1 inversion mix; target matches re-derived extremum', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = InsideOutsideCountPickChallenge500Module.generate(1) as Data
      expect(data.groups).toHaveLength(4)
      expect(data.groups.every((g) => g.zone === 'inside')).toBe(true)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const counts = data.groups.map((g) => g.icons.length)
      expect(new Set(counts).size).toBe(counts.length)

      const { wantMost } = deriveEffective(data)
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)
      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.icons.length).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: 6 groups (3 inside, 3 outside); 0/1/2 inversion mix; target matches the effective zone', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = InsideOutsideCountPickChallenge500Module.generate(2) as Data
      expect(data.groups).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantMost, effectiveZone } = deriveEffective(data)
      expect(effectiveZone).not.toBeNull()
      const pool = data.groups.filter((g) => g.zone === effectiveZone)
      expect(pool).toHaveLength(3)
      const counts = pool.map((g) => g.icons.length)
      expect(new Set(counts).size).toBe(3)
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)

      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.zone).toBe(effectiveZone)
      expect(target.icons.length).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: always has the non-inverted target-shape counting condition', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = InsideOutsideCountPickChallenge500Module.generate(3) as Data
      expect(data.groups).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('だけを数えて'))).toBe(true)

      const { wantMost, effectiveZone } = deriveEffective(data)
      expect(effectiveZone).not.toBeNull()
      const pool = data.groups.filter((g) => g.zone === effectiveZone)
      expect(pool).toHaveLength(3)
      const counts = pool.map((g) => g.targetCount!)
      expect(new Set(counts).size).toBe(3)
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)

      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.targetCount).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('every generated spec has a target that exists in its own groups array', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = InsideOutsideCountPickChallenge500Module.generate(tier) as Data
        expect(data.groups.some((g) => g.id === data.targetId)).toBe(true)
      }
    }
  })
})
