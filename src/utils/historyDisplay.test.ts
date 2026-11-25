import { describe, expect, it } from 'vitest'
import { applyHistoryDisplayLimit } from './historyDisplay'

describe('historyDisplay (DOPA PASS基盤ラウンド)', () => {
  it('hasFullHistory=falseでは直近5件だけを返す', () => {
    const items = Array.from({ length: 8 }, (_, i) => `id-${i}`)
    const result = applyHistoryDisplayLimit(items, false)
    expect(result.visible).toEqual(['id-0', 'id-1', 'id-2', 'id-3', 'id-4'])
    expect(result.truncated).toBe(true)
  })

  it('hasFullHistory=trueでは全件返し、truncated=false', () => {
    const items = Array.from({ length: 8 }, (_, i) => `id-${i}`)
    const result = applyHistoryDisplayLimit(items, true)
    expect(result.visible).toEqual(items)
    expect(result.truncated).toBe(false)
  })

  it('5件以下ならhasFullHistory=falseでもtruncated=false', () => {
    const items = ['a', 'b', 'c']
    const result = applyHistoryDisplayLimit(items, false)
    expect(result.visible).toEqual(items)
    expect(result.truncated).toBe(false)
  })
})
