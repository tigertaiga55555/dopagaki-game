import { describe, expect, it } from 'vitest'
import { sequenceOrderOf } from './SelectionOrderBadge'

describe('sequenceOrderOf (Ver.6 Phase 7: 順番選択問題の①②③表示ロジック)', () => {
  const order = [30, 10, 50]

  it('returns null for a value not yet reached (clearedCount too low)', () => {
    expect(sequenceOrderOf(30, order, 0)).toBeNull()
  })

  it('returns 1 for the first-tapped value once clearedCount reaches 1', () => {
    expect(sequenceOrderOf(30, order, 1)).toBe(1)
  })

  it('returns 2 for the second-tapped value once clearedCount reaches 2 (not before)', () => {
    expect(sequenceOrderOf(10, order, 1)).toBeNull()
    expect(sequenceOrderOf(10, order, 2)).toBe(2)
  })

  it('returns 3 for the third-tapped value once clearedCount reaches 3', () => {
    expect(sequenceOrderOf(50, order, 2)).toBeNull()
    expect(sequenceOrderOf(50, order, 3)).toBe(3)
  })

  it('returns null for a value not present in order at all', () => {
    expect(sequenceOrderOf(999, order, 3)).toBeNull()
  })

  it('works identically when order holds ids instead of raw values', () => {
    const idOrder = [2, 0, 1]
    expect(sequenceOrderOf(2, idOrder, 1)).toBe(1)
    expect(sequenceOrderOf(0, idOrder, 2)).toBe(2)
    expect(sequenceOrderOf(1, idOrder, 3)).toBe(3)
  })
})
