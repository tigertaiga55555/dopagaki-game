import { describe, expect, it } from 'vitest'
import { computeHeartSlotsView, isHeartSlotFilledAt } from './heartDisplay'

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

describe('isHeartSlotFilledAt（次フェーズ: FRIENDS/ナビ刷新ラウンド、item 35 — 空は左・満は右）', () => {
  it('3/5のとき: index0,1が空・index2,3,4が満（左2つが空）', () => {
    const view = computeHeartSlotsView(3, 5)
    expect([0, 1, 2, 3, 4].map((i) => isHeartSlotFilledAt(view, i))).toEqual([false, false, true, true, true])
  })

  it('4/5のとき: index0だけ空・残り4つが満（3→4で境界の1枠だけが新たに塗られる）', () => {
    const view = computeHeartSlotsView(4, 5)
    expect([0, 1, 2, 3, 4].map((i) => isHeartSlotFilledAt(view, i))).toEqual([false, true, true, true, true])
  })

  it('5/5のとき: 全枠満', () => {
    const view = computeHeartSlotsView(5, 5)
    expect([0, 1, 2, 3, 4].every((i) => isHeartSlotFilledAt(view, i))).toBe(true)
  })

  it('0/5のとき: 全枠空', () => {
    const view = computeHeartSlotsView(0, 5)
    expect([0, 1, 2, 3, 4].some((i) => isHeartSlotFilledAt(view, i))).toBe(false)
  })
})
