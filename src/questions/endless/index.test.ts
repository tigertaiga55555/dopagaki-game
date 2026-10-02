import { describe, expect, it } from 'vitest'
import { eligibleModulesForTier, ENDLESS_QUESTION_MODULES, pickEndlessQuestion, tierForPercent } from './index'

describe('endless question tier/picker', () => {
  it('maps percent ranges to the correct tier', () => {
    expect(tierForPercent(200)).toBe(1)
    expect(tierForPercent(299)).toBe(1)
    expect(tierForPercent(300)).toBe(2)
    expect(tierForPercent(399)).toBe(2)
    expect(tierForPercent(400)).toBe(3)
    expect(tierForPercent(499)).toBe(3)
  })

  it('tier1 includes all modules; tier2/3 exclude the swipe-only template', () => {
    expect(eligibleModulesForTier(1).length).toBe(ENDLESS_QUESTION_MODULES.length)
    expect(eligibleModulesForTier(2).some((m) => m.id === 'endlessSwipeDirection')).toBe(false)
    expect(eligibleModulesForTier(3).some((m) => m.id === 'endlessSwipeDirection')).toBe(false)
  })

  it('pickEndlessQuestion avoids repeating the immediately preceding type when alternatives exist', () => {
    for (let i = 0; i < 100; i++) {
      const spec = pickEndlessQuestion(250, 'endlessNumberPick')
      // tier1には3種あるため、直前と同じ型が連続することは絶対にない。
      expect(spec.type).not.toBe('endlessNumberPick')
    }
  })

  it('pickEndlessQuestion always returns a spec usable by one of the registered modules', () => {
    for (let i = 0; i < 50; i++) {
      const spec = pickEndlessQuestion(350, null)
      expect(ENDLESS_QUESTION_MODULES.some((m) => m.id === spec.type)).toBe(true)
    }
  })
})
