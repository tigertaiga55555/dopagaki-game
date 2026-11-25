import { describe, expect, it } from 'vitest'
import { ENDLESS_INTERMEDIATE_POOL_TIERS } from '../config/endlessConfig'
import { INTERMEDIATE_TIER_CURVE, intermediateTierWeightsAtStreak, pickEndlessIntermediateTier, type EndlessIntermediateTier } from './endlessIntermediatePicker'

const DRAWS = 500
const ALL_TIERS: EndlessIntermediateTier[] = ['reversal', 'twoCondition']

describe('endlessIntermediatePicker (item 154-156: 中級のreversal/twoCondition混在ロジック、STREAK連動)', () => {
  it('matches ENDLESS_INTERMEDIATE_POOL_TIERS exactly (reversal/twoConditionの2値のみ)', () => {
    expect(new Set(ENDLESS_INTERMEDIATE_POOL_TIERS)).toEqual(new Set(ALL_TIERS))
  })

  it('every control point weight sums to exactly 100', () => {
    for (const point of INTERMEDIATE_TIER_CURVE) {
      const total = Object.values(point.weights).reduce((sum, w) => sum + w, 0)
      expect(total).toBe(100)
    }
  })

  it('both tiers appear across many draws at low streak with no recent history', () => {
    const seen = new Set<EndlessIntermediateTier>()
    for (let i = 0; i < DRAWS; i++) seen.add(pickEndlessIntermediateTier(1, []))
    expect(seen).toEqual(new Set(ALL_TIERS))
  })

  it('both tiers still appear across many draws at a very long streak (no pool exhaustion)', () => {
    const seen = new Set<EndlessIntermediateTier>()
    for (let i = 0; i < DRAWS; i++) seen.add(pickEndlessIntermediateTier(500, []))
    expect(seen).toEqual(new Set(ALL_TIERS))
  })

  it('never produces 3 consecutive draws of the same tier when fed back into itself (anti-clustering)', () => {
    const history: EndlessIntermediateTier[] = []
    for (let i = 0; i < DRAWS; i++) {
      const next = pickEndlessIntermediateTier(i, history)
      history.unshift(next)
      if (history.length > 3) history.pop()
      if (history.length >= 3) {
        expect(history[0] === history[1] && history[1] === history[2]).toBe(false)
      }
    }
  })

  it('forces the opposite tier after 2-in-a-row of the same tier', () => {
    expect(pickEndlessIntermediateTier(50, ['reversal', 'reversal'])).toBe('twoCondition')
    expect(pickEndlessIntermediateTier(50, ['twoCondition', 'twoCondition'])).toBe('reversal')
  })

  it('reversal weight decreases (and twoCondition weight increases) monotonically as streak grows (ladder milestones 5/15/30/50/75/100)', () => {
    const streaks = [1, 5, 15, 30, 50, 75, 100, 150, 300]
    let prevReversal = Infinity
    let prevTwoCondition = -Infinity
    for (const s of streaks) {
      const w = intermediateTierWeightsAtStreak(s)
      expect(w.reversal).toBeLessThanOrEqual(prevReversal)
      expect(w.twoCondition).toBeGreaterThanOrEqual(prevTwoCondition)
      prevReversal = w.reversal
      prevTwoCondition = w.twoCondition
    }
  })

  it('reversal weight never drops to 0 even at very long streaks (pool diversity floor, same philosophy as CHALLENGE500_INVERSION_WEIGHTS)', () => {
    const w = intermediateTierWeightsAtStreak(10000)
    expect(w.reversal).toBeGreaterThan(0)
  })

  it('at streak=1 reversal dominates; at streak>=100 twoCondition dominates', () => {
    const early = intermediateTierWeightsAtStreak(1)
    expect(early.reversal).toBeGreaterThan(early.twoCondition)
    const late = intermediateTierWeightsAtStreak(100)
    expect(late.twoCondition).toBeGreaterThan(late.reversal)
  })
})
