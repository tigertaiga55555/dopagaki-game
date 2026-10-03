import { describe, expect, it } from 'vitest'
import { eligibleModulesForTier, CHALLENGE500_QUESTION_MODULES, pickChallenge500Question, tierForPercent } from './index'

describe('challenge500 question tier/picker', () => {
  it('maps percent ranges to the correct tier', () => {
    expect(tierForPercent(200)).toBe(1)
    expect(tierForPercent(299)).toBe(1)
    expect(tierForPercent(300)).toBe(2)
    expect(tierForPercent(399)).toBe(2)
    expect(tierForPercent(400)).toBe(3)
    expect(tierForPercent(499)).toBe(3)
  })

  it('tier1 includes all modules; tier2/3 exclude the swipe-only templates', () => {
    expect(eligibleModulesForTier(1).length).toBe(CHALLENGE500_QUESTION_MODULES.length)
    for (const id of ['challenge500SwipeDirection', 'challenge500InterferenceSwipe']) {
      expect(eligibleModulesForTier(2).some((m) => m.id === id)).toBe(false)
      expect(eligibleModulesForTier(3).some((m) => m.id === id)).toBe(false)
    }
  })

  it('pickChallenge500Question avoids repeating the immediately preceding type when alternatives exist', () => {
    for (let i = 0; i < 100; i++) {
      const spec = pickChallenge500Question(250, 'challenge500NumberPick')
      // tier1には複数種あるため、直前と同じ型が連続することは絶対にない。
      expect(spec.type).not.toBe('challenge500NumberPick')
    }
  })

  it('pickChallenge500Question always returns a spec usable by one of the registered modules', () => {
    for (let i = 0; i < 50; i++) {
      const spec = pickChallenge500Question(350, null)
      expect(CHALLENGE500_QUESTION_MODULES.some((m) => m.id === spec.type)).toBe(true)
    }
  })
})
