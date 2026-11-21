import { describe, expect, it } from 'vitest'
import { FINAL_QUESTION_POOLS } from '../questions/final'
import { CHALLENGE500_QUESTION_MODULES } from '../questions/challenge500'
import { tierForPercent } from '../config/challenge500Config'
import {
  CHALLENGE500_ENDLESS_TIERS,
  CHALLENGE500_TIER_REPRESENTATIVE_PERCENT,
  ENDLESS_ADVANCED_ORIGIN_WEIGHTS,
  pickEndlessAdvancedOrigin,
  type EndlessAdvancedOrigin,
} from './endlessAdvancedPicker'

const DRAWS = 500

describe('endlessAdvancedPicker (Ver.6 Phase 4.2: 上級のFINAL/Challenge500混在ロジック)', () => {
  it('weights are derived from the actual module counts, not a hardcoded ratio', () => {
    const finalCount = Object.values(FINAL_QUESTION_POOLS).reduce((sum, pool) => sum + pool.length, 0)
    expect(ENDLESS_ADVANCED_ORIGIN_WEIGHTS.final).toBe(finalCount)
    expect(ENDLESS_ADVANCED_ORIGIN_WEIGHTS.challenge500).toBe(CHALLENGE500_QUESTION_MODULES.length)
  })

  it('weights are not a flat 50:50 split (explicitly avoided per spec)', () => {
    expect(ENDLESS_ADVANCED_ORIGIN_WEIGHTS.final).not.toBe(ENDLESS_ADVANCED_ORIGIN_WEIGHTS.challenge500)
  })

  it('both origins (final and challenge500) appear across many draws with no recent history', () => {
    const seen = new Set<EndlessAdvancedOrigin>()
    for (let i = 0; i < DRAWS; i++) {
      seen.add(pickEndlessAdvancedOrigin([]))
    }
    expect(seen).toEqual(new Set(['final', 'challenge500']))
  })

  it('never produces 3 consecutive draws of the same origin when fed back into itself (anti-clustering)', () => {
    const history: EndlessAdvancedOrigin[] = []
    for (let i = 0; i < DRAWS; i++) {
      const next = pickEndlessAdvancedOrigin(history)
      history.unshift(next)
      if (history.length > 3) history.pop()
      if (history.length >= 3) {
        expect(history[0] === history[1] && history[1] === history[2]).toBe(false)
      }
    }
  })

  it('forces the opposite origin after 2-in-a-row of the same origin', () => {
    expect(pickEndlessAdvancedOrigin(['final', 'final'])).toBe('challenge500')
    expect(pickEndlessAdvancedOrigin(['challenge500', 'challenge500'])).toBe('final')
  })

  it('CHALLENGE500_ENDLESS_TIERS covers all 3 Challenge500 tiers', () => {
    expect(new Set(CHALLENGE500_ENDLESS_TIERS)).toEqual(new Set([1, 2, 3]))
  })

  it('each representative percent resolves back to its own tier via the real tierForPercent', () => {
    for (const tier of CHALLENGE500_ENDLESS_TIERS) {
      expect(tierForPercent(CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier])).toBe(tier)
    }
  })
})
