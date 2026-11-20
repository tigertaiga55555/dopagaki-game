import { describe, expect, it } from 'vitest'
import { computeHeartSlotsView } from './heartDisplay'

describe('computeHeartSlotsView (次フェーズ: Heart UI強化ラウンド)', () => {
  it('5のとき: filled 5・overflow 0・回復timer非表示', () => {
    expect(computeHeartSlotsView(5, 5)).toEqual({ filledSlots: 5, totalSlots: 5, overflow: 0, showRecoveryTimer: false })
  })

  it('4のとき: filled 4・overflow 0・回復timer表示', () => {
    expect(computeHeartSlotsView(4, 5)).toEqual({ filledSlots: 4, totalSlots: 5, overflow: 0, showRecoveryTimer: true })
  })

  it('0のとき: filled 0・overflow 0・回復timer表示', () => {
    expect(computeHeartSlotsView(0, 5)).toEqual({ filledSlots: 0, totalSlots: 5, overflow: 0, showRecoveryTimer: true })
  })

  it('8のとき（上限超過）: filled 5・overflow 3・回復timer非表示', () => {
    expect(computeHeartSlotsView(8, 5)).toEqual({ filledSlots: 5, totalSlots: 5, overflow: 3, showRecoveryTimer: false })
  })

  it('負の値は0として扱う（保険）', () => {
    expect(computeHeartSlotsView(-1, 5)).toEqual({ filledSlots: 0, totalSlots: 5, overflow: 0, showRecoveryTimer: true })
  })
})
