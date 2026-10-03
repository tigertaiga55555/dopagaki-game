import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { ShapeCountPickChallenge500Module } from './ShapeCountPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'
import type { ShapeId } from '../../components/ShapeIcon'

interface Group {
  id: number
  side: 'left' | 'right'
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

  const sideSeg = data.segments.find((s) => s.text === '左' || s.text === '右')
  let effectiveSide: 'left' | 'right' | null = null
  if (sideSeg) {
    const sideWordShown = sideSeg.text as '左' | '右'
    const sideWordEffective = sideSeg.inverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }
  return { wantMost, effectiveSide }
}

describe('ShapeCountPickQuestion (inversion template, with 0/1/2-inversion mixing, 6-choice layout)', () => {
  it('tier1: 6 distinct-count groups; 0 or 1 inverted segments (never 2); target matches re-derived extremum', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = ShapeCountPickChallenge500Module.generate(1) as Data
      expect(data.groups).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const counts = data.groups.map((g) => g.icons.length)
      expect(new Set(counts).size).toBe(counts.length) // 個数が重複しない

      const { wantMost } = deriveEffective(data)
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)
      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.icons.length).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: 6 groups (3 per side); 0/1/2 inverted segments all occur; answer matches the effective side', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = ShapeCountPickChallenge500Module.generate(2) as Data
      expect(data.groups).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantMost, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.groups.filter((g) => g.side === effectiveSide)
      expect(pool).toHaveLength(3)
      const counts = pool.map((g) => g.icons.length)
      expect(new Set(counts).size).toBe(3) // 同率なし
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)

      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.side).toBe(effectiveSide)
      expect(target.icons.length).toBe(expected)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: 6 groups; always has the non-inverted target-shape condition; counts only the designated shape', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = ShapeCountPickChallenge500Module.generate(3) as Data
      expect(data.groups).toHaveLength(6)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('だけを数えて'))).toBe(true)

      const { wantMost, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.groups.filter((g) => g.side === effectiveSide)
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
        const data = ShapeCountPickChallenge500Module.generate(tier) as Data
        expect(data.groups.some((g) => g.id === data.targetId)).toBe(true)
      }
    }
  })
})
