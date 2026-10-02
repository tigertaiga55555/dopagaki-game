import { describe, expect, it } from 'vitest'
import { NumberPickEndlessModule } from './NumberPickQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

interface Item {
  id: number
  value: number
  side: 'left' | 'right'
}

const RUNS = 300

describe('NumberPickQuestion (inversion template)', () => {
  it('tier1: exactly one inverted segment, and the target is the unique effective extremum', () => {
    for (let i = 0; i < RUNS; i++) {
      const data = NumberPickEndlessModule.generate(1) as { items: Item[]; targetId: number; segments: PromptSegment[] }
      const invertedCount = data.segments.filter((s) => s.inverted).length
      expect(invertedCount).toBe(1)

      // 表示された語（反転扱い）と、実際に使うべき意味は常に逆でなければならない。
      const shown = data.segments.find((s) => s.inverted)!.text.trim()
      const wantMax = shown === '一番 小さい' // 表示が「小さい」なら実際は「大きい」を選ぶ
      const extreme = wantMax ? Math.max(...data.items.map((it) => it.value)) : Math.min(...data.items.map((it) => it.value))
      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value).toBe(extreme)

      // 候補内に値の重複がなく、正解が一意に決まること。
      const values = data.items.map((it) => it.value)
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('tier2: exactly two inverted segments (size + position); target matches the independently re-derived effective answer', () => {
    for (let i = 0; i < RUNS; i++) {
      const data = NumberPickEndlessModule.generate(2) as { items: Item[]; targetId: number; segments: PromptSegment[] }
      const invertedSegs = data.segments.filter((s) => s.inverted)
      expect(invertedSegs.length).toBe(2)

      const sideSeg = invertedSegs.find((s) => s.text === '左' || s.text === '右')!
      const sizeSeg = invertedSegs.find((s) => s.text.includes('大きい') || s.text.includes('小さい'))!
      expect(sideSeg).toBeDefined()
      expect(sizeSeg).toBeDefined()

      // 表示語から独立に「実際に使うべき意味」を再計算し、generate()自身の出したtargetIdと突き合わせる。
      const effectiveSide: 'left' | 'right' = sideSeg.text === '左' ? 'right' : 'left'
      const wantMax = sizeSeg.text.includes('小さい') // 表示が「小さい」なら実際は「大きい」
      const pool = data.items.filter((it) => it.side === effectiveSide)
      expect(pool).toHaveLength(2)
      const expectedValue = wantMax ? Math.max(...pool.map((it) => it.value)) : Math.min(...pool.map((it) => it.value))

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.side).toBe(effectiveSide)
      expect(target.value).toBe(expectedValue)

      // 4件とも値の重複がない（同率1位が構造的に起こり得ない）。
      expect(new Set(data.items.map((it) => it.value)).size).toBe(4)
    }
  })

  it('tier3: non-inverted parity condition + 2 inverted conditions; target matches the independently re-derived answer', () => {
    for (let i = 0; i < RUNS; i++) {
      const data = NumberPickEndlessModule.generate(3) as { items: Item[]; targetId: number; segments: PromptSegment[] }
      const invertedSegs = data.segments.filter((s) => s.inverted)
      expect(invertedSegs.length).toBe(2)
      // 非反転の通常条件（偶数指定）が必ず含まれる。
      expect(data.segments.some((s) => !s.inverted && s.text.includes('偶数'))).toBe(true)

      const sideSeg = invertedSegs.find((s) => s.text === '左' || s.text === '右')!
      const sizeSeg = invertedSegs.find((s) => s.text.includes('大きい') || s.text.includes('小さい'))!
      const effectiveSide: 'left' | 'right' = sideSeg.text === '左' ? 'right' : 'left'
      const wantMax = sizeSeg.text.includes('小さい')

      const pool = data.items.filter((it) => it.side === effectiveSide && it.value % 2 === 0)
      expect(pool.length).toBeGreaterThan(0) // 正解が必ず存在する
      const expectedValue = wantMax ? Math.max(...pool.map((it) => it.value)) : Math.min(...pool.map((it) => it.value))

      const target = data.items.find((it) => it.id === data.targetId)!
      expect(target.value % 2).toBe(0)
      expect(target.side).toBe(effectiveSide)
      expect(target.value).toBe(expectedValue)

      // 8項目、重複なし。
      expect(data.items).toHaveLength(8)
      expect(new Set(data.items.map((it) => it.value)).size).toBe(8)
    }
  })

  it('every generated spec has a target that exists in its own items array (answer existence guarantee)', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = NumberPickEndlessModule.generate(tier) as { items: Item[]; targetId: number }
        expect(data.items.some((it) => it.id === data.targetId)).toBe(true)
      }
    }
  })
})
