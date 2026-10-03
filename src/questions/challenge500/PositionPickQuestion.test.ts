import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { PositionPickChallenge500Module } from './PositionPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

interface Item {
  id: number
  value: number
  side: 'left' | 'right'
  order: number
}

type Data = { items: Item[]; targetId: number; segments: PromptSegment[] }

const RUNS = 600

function deriveEffective(data: Data) {
  const posSeg = data.segments.find((s) => s.text.includes('最初') || s.text.includes('最後'))!
  const posWordShown = posSeg.text.includes('最初') ? '最初' : '最後'
  const posWordEffective = posSeg.inverted ? opposite('firstLast', posWordShown) : posWordShown
  const wantFirst = posWordEffective === '最初'

  const sideSeg = data.segments.find((s) => s.text === '左' || s.text === '右')
  let effectiveSide: 'left' | 'right' | null = null
  if (sideSeg) {
    const sideWordShown = sideSeg.text as '左' | '右'
    const sideWordEffective = sideSeg.inverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }
  return { wantFirst, effectiveSide }
}

describe('PositionPickQuestion (ordinal-position inversion template)', () => {
  it('tier1: single row of 5, 0 or 1 inverted segments, target matches re-derived first/last', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = PositionPickChallenge500Module.generate(1) as Data
      expect(data.items).toHaveLength(5)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const { wantFirst } = deriveEffective(data)
      const row = [...data.items].sort((a, b) => a.order - b.order)
      const expected = wantFirst ? row[0] : row[row.length - 1]
      expect(data.targetId).toBe(expected.id)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: two rows of 5; 0/1/2 inverted segments all occur; target matches the effective side+position', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = PositionPickChallenge500Module.generate(2) as Data
      expect(data.items).toHaveLength(10)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantFirst, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const row = data.items.filter((it) => it.side === effectiveSide).sort((a, b) => a.order - b.order)
      expect(row).toHaveLength(5)
      const expected = wantFirst ? row[0] : row[row.length - 1]
      expect(data.targetId).toBe(expected.id)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: rows guarantee >=3 even values after the non-inverted parity filter (never empty)', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = PositionPickChallenge500Module.generate(3) as Data
      expect(data.items).toHaveLength(12)
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      expect(data.segments.some((s) => !s.inverted && s.text.includes('偶数'))).toBe(true)

      const { wantFirst, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const row = data.items
        .filter((it) => it.side === effectiveSide && it.value % 2 === 0)
        .sort((a, b) => a.order - b.order)
      expect(row.length).toBeGreaterThanOrEqual(3)
      const expected = wantFirst ? row[0] : row[row.length - 1]
      expect(data.targetId).toBe(expected.id)
      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value % 2).toBe(0)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('every generated spec has a target that exists in its own items array', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = PositionPickChallenge500Module.generate(tier) as Data
        expect(data.items.some((it) => it.id === data.targetId)).toBe(true)
      }
    }
  })
})
