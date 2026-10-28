import { describe, expect, it } from 'vitest'
import { pickInversionCount } from './inversionPicker'

describe('pickInversionCount', () => {
  it('never exceeds the given maxSlots', () => {
    for (const tier of [1, 2, 3] as const) {
      for (const maxSlots of [0, 1, 2] as const) {
        for (let i = 0; i < 300; i++) {
          const count = pickInversionCount(tier, maxSlots)
          expect(count).toBeLessThanOrEqual(maxSlots)
          expect(count).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('maxSlots=0 always returns 0 regardless of tier', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        expect(pickInversionCount(tier, 0)).toBe(0)
      }
    }
  })

  it('tier1 never produces a 2-inversion result even with maxSlots=2 (weight is 0)', () => {
    for (let i = 0; i < 500; i++) {
      expect(pickInversionCount(1, 2)).not.toBe(2)
    }
  })

  it('every outcome (0 and 1+) is reachable for tier1 with maxSlots=1 (no-inversion questions must occur)', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(pickInversionCount(1, 1))
    expect(seen.has(0)).toBe(true)
    expect(seen.has(1)).toBe(true)
  })

  it('tier2/tier3 with maxSlots=2 can reach all of 0, 1, and 2 (no-inversion must still occur at higher tiers)', () => {
    for (const tier of [2, 3] as const) {
      const seen = new Set<number>()
      for (let i = 0; i < 1000; i++) seen.add(pickInversionCount(tier, 2))
      expect(seen.has(0)).toBe(true)
      expect(seen.has(1)).toBe(true)
      expect(seen.has(2)).toBe(true)
    }
  })

  it('roughly tracks the configured ratio for tier1 (statistical sanity, generous tolerance)', () => {
    let zeroCount = 0
    const trials = 4000
    for (let i = 0; i < trials; i++) {
      if (pickInversionCount(1, 1) === 0) zeroCount++
    }
    // configured weight: 0=35, 1=65 out of 100 -> expect ~35%, allow wide tolerance for a flaky-free CI run
    const ratio = zeroCount / trials
    expect(ratio).toBeGreaterThan(0.2)
    expect(ratio).toBeLessThan(0.5)
  })
})
