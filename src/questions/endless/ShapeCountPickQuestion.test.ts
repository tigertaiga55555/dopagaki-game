import { describe, expect, it } from 'vitest'
import { ShapeCountPickEndlessModule } from './ShapeCountPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'
import type { ShapeId } from '../../components/ShapeIcon'

interface Group {
  id: number
  side: 'left' | 'right'
  icons: ShapeId[]
  targetCount?: number
}

const RUNS = 300

describe('ShapeCountPickQuestion (inversion template)', () => {
  it('tier1: exactly one inverted segment; target group matches the independently re-derived extremum', () => {
    for (let i = 0; i < RUNS; i++) {
      const data = ShapeCountPickEndlessModule.generate(1) as { groups: Group[]; targetId: number; segments: PromptSegment[] }
      const invertedSegs = data.segments.filter((s) => s.inverted)
      expect(invertedSegs.length).toBe(1)
      const countSeg = invertedSegs[0]
      const wantMost = countSeg.text.includes('少ない') // 表示が「少ない」なら実際は「多い」

      const counts = data.groups.map((g) => g.icons.length)
      expect(new Set(counts).size).toBe(counts.length) // 個数が重複しない

      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)
      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.icons.length).toBe(expected)
    }
  })

  it('tier2: exactly two inverted segments (count + position); answer matches the effective side', () => {
    for (let i = 0; i < RUNS; i++) {
      const data = ShapeCountPickEndlessModule.generate(2) as { groups: Group[]; targetId: number; segments: PromptSegment[] }
      const invertedSegs = data.segments.filter((s) => s.inverted)
      expect(invertedSegs.length).toBe(2)

      const sideSeg = invertedSegs.find((s) => s.text === '左' || s.text === '右')!
      const countSeg = invertedSegs.find((s) => s.text.includes('多い') || s.text.includes('少ない'))!
      const effectiveSide: 'left' | 'right' = sideSeg.text === '左' ? 'right' : 'left'
      const wantMost = countSeg.text.includes('少ない')

      const pool = data.groups.filter((g) => g.side === effectiveSide)
      expect(pool).toHaveLength(2)
      const counts = pool.map((g) => g.icons.length)
      expect(new Set(counts).size).toBe(2) // 同率なし
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)

      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.side).toBe(effectiveSide)
      expect(target.icons.length).toBe(expected)
    }
  })

  it('tier3: non-inverted target-shape condition + 2 inverted conditions; counts only the designated shape', () => {
    for (let i = 0; i < RUNS; i++) {
      const data = ShapeCountPickEndlessModule.generate(3) as { groups: Group[]; targetId: number; segments: PromptSegment[] }
      const invertedSegs = data.segments.filter((s) => s.inverted)
      expect(invertedSegs.length).toBe(2)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('だけを数えて'))).toBe(true)

      const sideSeg = invertedSegs.find((s) => s.text === '左' || s.text === '右')!
      const countSeg = invertedSegs.find((s) => s.text.includes('多い') || s.text.includes('少ない'))!
      const effectiveSide: 'left' | 'right' = sideSeg.text === '左' ? 'right' : 'left'
      const wantMost = countSeg.text.includes('少ない')

      const pool = data.groups.filter((g) => g.side === effectiveSide)
      expect(pool).toHaveLength(2)
      const counts = pool.map((g) => g.targetCount!)
      expect(new Set(counts).size).toBe(2)
      const expected = wantMost ? Math.max(...counts) : Math.min(...counts)

      const target = data.groups.find((g) => g.id === data.targetId)!
      expect(target.targetCount).toBe(expected)
    }
  })

  it('every generated spec has a target that exists in its own groups array', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = ShapeCountPickEndlessModule.generate(tier) as { groups: Group[]; targetId: number }
        expect(data.groups.some((g) => g.id === data.targetId)).toBe(true)
      }
    }
  })
})
