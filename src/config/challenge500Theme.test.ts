import { describe, expect, it } from 'vitest'
import { getChallenge500Theme, getChallenge500TierProgress } from './challenge500Theme'

describe('challenge500Theme', () => {
  describe('getChallenge500TierProgress', () => {
    it('tier1: 200% -> 0, 290% -> ~1', () => {
      expect(getChallenge500TierProgress(1, 200)).toBe(0)
      expect(getChallenge500TierProgress(1, 290)).toBeCloseTo(1)
    })
    it('tier2: 300% -> 0, 390% -> ~1', () => {
      expect(getChallenge500TierProgress(2, 300)).toBe(0)
      expect(getChallenge500TierProgress(2, 390)).toBeCloseTo(1)
    })
    it('tier3: 400% -> 0, 480% -> 1', () => {
      expect(getChallenge500TierProgress(3, 400)).toBe(0)
      expect(getChallenge500TierProgress(3, 480)).toBe(1)
    })
    it('clamps to [0,1] even for out-of-range values', () => {
      expect(getChallenge500TierProgress(1, 199)).toBe(0)
      expect(getChallenge500TierProgress(3, 490)).toBe(1)
    })
  })

  describe('getChallenge500Theme', () => {
    it('each tier gets a distinct theme id and color (different "personality")', () => {
      const t1 = getChallenge500Theme(1, 200, false)
      const t2 = getChallenge500Theme(2, 300, false)
      const t3 = getChallenge500Theme(3, 400, false)
      expect(t1.id).toBe('limitBreak')
      expect(t2.id).toBe('overload')
      expect(t3.id).toBe('danger')
      const colors = new Set([t1.colorRgb, t2.colorRgb, t3.colorRgb])
      expect(colors.size).toBe(3)
    })

    it('isFinalQuestionPhase overrides tier3 into a hushed finalQuestion theme (fewer particles, lower glow than tier3 danger)', () => {
      const danger480 = getChallenge500Theme(3, 480, false)
      const finalQuestion = getChallenge500Theme(3, 490, true)
      expect(finalQuestion.id).toBe('finalQuestion')
      expect(finalQuestion.particleCount).toBeLessThan(danger480.particleCount)
      expect(finalQuestion.glowMax).toBeLessThan(danger480.glowMax)
    })

    it('density/glow/pulse-speed increase monotonically as tierProgress advances within a tier (section 6 requirement)', () => {
      for (const tier of [1, 2, 3] as const) {
        const range = tier === 3 ? [400, 480] : tier === 2 ? [300, 390] : [200, 290]
        const early = getChallenge500Theme(tier, range[0], false)
        const late = getChallenge500Theme(tier, range[1], false)
        expect(late.particleCount).toBeGreaterThanOrEqual(early.particleCount)
        expect(late.glowMax).toBeGreaterThan(early.glowMax)
        expect(late.pulseMs).toBeLessThan(early.pulseMs) // faster pulse = more agitated
      }
    })

    it('particle count never exceeds the performance budget of 10', () => {
      for (const tier of [1, 2, 3] as const) {
        for (let p = 0; p <= 1; p += 0.1) {
          const percent = tier === 1 ? 200 + p * 90 : tier === 2 ? 300 + p * 90 : 400 + p * 80
          const theme = getChallenge500Theme(tier, percent, false)
          expect(theme.particleCount).toBeLessThanOrEqual(10)
        }
      }
    })

    it('danger (tier3) theme is visually more intense than overload (tier2) at matching tierProgress=0', () => {
      const overload = getChallenge500Theme(2, 300, false)
      const danger = getChallenge500Theme(3, 400, false)
      expect(danger.glowMax).toBeGreaterThan(overload.glowMax)
      expect(danger.pulseMs).toBeLessThan(overload.pulseMs)
    })

    it('overload (tier2) theme is visually more intense than limitBreak (tier1) at matching tierProgress=0', () => {
      const limitBreak = getChallenge500Theme(1, 200, false)
      const overload = getChallenge500Theme(2, 300, false)
      expect(overload.glowMax).toBeGreaterThan(limitBreak.glowMax)
      expect(overload.pulseMs).toBeLessThan(limitBreak.pulseMs)
    })
  })
})
