import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { NumberPickChallenge500Module } from './NumberPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

interface Item {
  id: number
  value: number
  side: 'left' | 'right'
}

type Data = { items: Item[]; targetId: number; segments: PromptSegment[] }

const RUNS = 600

/** segmentsから独立に「実際に使うべき意味」を再計算する。表示語の反転有無に関わらず正しいこと。 */
function deriveEffective(data: Data) {
  const sizeSeg = data.segments.find((s) => s.text.includes('大きい') || s.text.includes('小さい'))!
  const sizeWordShown = sizeSeg.text.includes('大きい') ? '大きい' : '小さい'
  const sizeWordEffective = sizeSeg.inverted ? opposite('bigSmall', sizeWordShown) : sizeWordShown
  const wantMax = sizeWordEffective === '大きい'

  const sideSeg = data.segments.find((s) => s.text === '左' || s.text === '右')
  let effectiveSide: 'left' | 'right' | null = null
  if (sideSeg) {
    const sideWordShown = sideSeg.text as '左' | '右'
    const sideWordEffective = sideSeg.inverted ? opposite('leftRight', sideWordShown) : sideWordShown
    effectiveSide = sideWordEffective === '左' ? 'left' : 'right'
  }
  return { wantMax, effectiveSide }
}

describe('NumberPickQuestion (inversion template, with 0/1/2-inversion mixing)', () => {
  it('tier1: 0 or 1 inverted segments (never 2, since only one axis exists); target matches re-derived answer', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = NumberPickChallenge500Module.generate(1) as Data
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(1)
      seenCounts.add(invertedCount)

      const { wantMax } = deriveEffective(data)
      const extreme = wantMax ? Math.max(...data.items.map((it) => it.value)) : Math.min(...data.items.map((it) => it.value))
      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value).toBe(extreme)

      const values = data.items.map((it) => it.value)
      expect(new Set(values).size).toBe(values.length)
    }
    // 反転なし(0)問題が必ず出ることを確認する（毎問必ず反転は禁止、という訂正事項）。
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
  })

  it('tier2: 0/1/2 inverted segments all occur; target always matches the independently re-derived effective answer', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = NumberPickChallenge500Module.generate(2) as Data
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)

      const { wantMax, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide)
      expect(pool).toHaveLength(2)
      const expectedValue = wantMax ? Math.max(...pool.map((it) => it.value)) : Math.min(...pool.map((it) => it.value))

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.side).toBe(effectiveSide)
      expect(target.value).toBe(expectedValue)

      expect(new Set(data.items.map((it) => it.value)).size).toBe(4)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('tier3: always has the non-inverted parity condition; 0/1/2 inverted segments all occur; target matches re-derived answer', () => {
    const seenCounts = new Set<number>()
    for (let i = 0; i < RUNS; i++) {
      const data = NumberPickChallenge500Module.generate(3) as Data
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBeLessThanOrEqual(2)
      seenCounts.add(invertedCount)
      // 非反転の通常条件（偶数指定）が必ず含まれる。
      expect(data.segments.some((s) => !s.inverted && s.text.includes('偶数'))).toBe(true)

      const { wantMax, effectiveSide } = deriveEffective(data)
      expect(effectiveSide).not.toBeNull()
      const pool = data.items.filter((it) => it.side === effectiveSide && it.value % 2 === 0)
      expect(pool.length).toBeGreaterThan(0) // 正解が必ず存在する
      const expectedValue = wantMax ? Math.max(...pool.map((it) => it.value)) : Math.min(...pool.map((it) => it.value))

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value % 2).toBe(0)
      expect(target.side).toBe(effectiveSide)
      expect(target.value).toBe(expectedValue)

      expect(data.items).toHaveLength(8)
      expect(new Set(data.items.map((it) => it.value)).size).toBe(8)
    }
    expect(seenCounts.has(0)).toBe(true)
    expect(seenCounts.has(1)).toBe(true)
    expect(seenCounts.has(2)).toBe(true)
  })

  it('every generated spec has a target that exists in its own items array (answer existence guarantee)', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = NumberPickChallenge500Module.generate(tier) as Data
        expect(data.items.some((it) => it.id === data.targetId)).toBe(true)
      }
    }
  })
})
