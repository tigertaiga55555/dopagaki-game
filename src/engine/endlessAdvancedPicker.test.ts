import { describe, expect, it } from 'vitest'
import { tierForPercent } from '../config/challenge500Config'
import {
  ADVANCED_CATEGORY_CURVE,
  CHALLENGE500_TIER_REPRESENTATIVE_PERCENT,
  advancedCategoryWeightsAtStreak,
  advancedExpectedDifficultyAtStreak,
  endlessAdvancedCategoryToChallenge500Tier,
  endlessAdvancedCategoryToFinalTier,
  pickEndlessAdvancedCategory,
  type EndlessAdvancedCategory,
} from './endlessAdvancedPicker'

const DRAWS = 500
const ALL_CATEGORIES: EndlessAdvancedCategory[] = [
  'final-memory',
  'final-mixed',
  'challenge500-tier1',
  'challenge500-tier2',
  'challenge500-tier3',
]

describe('endlessAdvancedPicker (item 154-156: 上級のmemory/mixed+Challenge500混在ロジック、STREAK連動)', () => {
  it('every control point weight sums to exactly 100 (normalized proportions)', () => {
    for (const point of ADVANCED_CATEGORY_CURVE) {
      const total = Object.values(point.weights).reduce((sum, w) => sum + w, 0)
      expect(total).toBe(100)
    }
  })

  it('all 5 categories appear across many draws at low streak with no recent history', () => {
    const seen = new Set<EndlessAdvancedCategory>()
    for (let i = 0; i < DRAWS; i++) {
      seen.add(pickEndlessAdvancedCategory(1, []))
    }
    expect(seen).toEqual(new Set(ALL_CATEGORIES))
  })

  it('all 5 categories still appear across many draws at a very long streak (no pool exhaustion/starvation)', () => {
    const seen = new Set<EndlessAdvancedCategory>()
    for (let i = 0; i < DRAWS * 4; i++) {
      seen.add(pickEndlessAdvancedCategory(500, []))
    }
    expect(seen).toEqual(new Set(ALL_CATEGORIES))
  })

  it('never produces 3 consecutive draws of the same category when fed back into itself (anti-clustering)', () => {
    const history: EndlessAdvancedCategory[] = []
    for (let i = 0; i < DRAWS; i++) {
      const next = pickEndlessAdvancedCategory(i, history)
      history.unshift(next)
      if (history.length > 3) history.pop()
      if (history.length >= 3) {
        expect(history[0] === history[1] && history[1] === history[2]).toBe(false)
      }
    }
  })

  it('forces a different category after 2-in-a-row of the same category', () => {
    for (const category of ALL_CATEGORIES) {
      const next = pickEndlessAdvancedCategory(50, [category, category])
      expect(next).not.toBe(category)
    }
  })

  it('expected difficulty (weighted by category difficulty score) increases monotonically as streak grows (ladder milestones 3/10/20/30/50/100)', () => {
    const streaks = [1, 3, 10, 20, 30, 50, 75, 100, 150, 300]
    let prev = -Infinity
    for (const s of streaks) {
      const value = advancedExpectedDifficultyAtStreak(s)
      expect(value).toBeGreaterThanOrEqual(prev)
      prev = value
    }
  })

  it('at streak=1, final-memory (easiest) has the largest weight; at streak=100+, challenge500-tier3 (hardest) has the largest weight', () => {
    const early = advancedCategoryWeightsAtStreak(1)
    const earlyMax = Math.max(...Object.values(early))
    expect(early['final-memory']).toBe(earlyMax)
    const late = advancedCategoryWeightsAtStreak(200)
    const lateMax = Math.max(...Object.values(late))
    expect(late['challenge500-tier3']).toBe(lateMax)
  })

  it('final-memory never drops to 0 even at very long streaks (pool diversity floor)', () => {
    const weights = advancedCategoryWeightsAtStreak(10000)
    expect(weights['final-memory']).toBeGreaterThan(0)
  })

  it('endlessAdvancedCategoryToFinalTier/ToChallenge500Tier map each category to exactly one tier system', () => {
    expect(endlessAdvancedCategoryToFinalTier('final-memory')).toBe('memory')
    expect(endlessAdvancedCategoryToFinalTier('final-mixed')).toBe('mixed')
    expect(endlessAdvancedCategoryToFinalTier('challenge500-tier1')).toBeNull()
    expect(endlessAdvancedCategoryToChallenge500Tier('challenge500-tier1')).toBe(1)
    expect(endlessAdvancedCategoryToChallenge500Tier('challenge500-tier2')).toBe(2)
    expect(endlessAdvancedCategoryToChallenge500Tier('challenge500-tier3')).toBe(3)
    expect(endlessAdvancedCategoryToChallenge500Tier('final-memory')).toBeNull()
  })

  it('each representative percent resolves back to its own tier via the real tierForPercent', () => {
    for (const tier of [1, 2, 3] as const) {
      expect(tierForPercent(CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier])).toBe(tier)
    }
  })
})
