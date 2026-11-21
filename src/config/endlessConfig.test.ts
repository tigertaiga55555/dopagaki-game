import { describe, expect, it } from 'vitest'
import { DIFFICULTY_PHASES } from './difficultyConfig'
import {
  ENDLESS_BEGINNER_BGM_STAGE_INDEX,
  ENDLESS_BEGINNER_PHASE,
  ENDLESS_DIFFICULTIES,
  ENDLESS_DIFFICULTY_LABEL,
  FINAL_POOL_TIERS,
  endlessMilestoneLevel,
  isEndlessMilestone,
} from './endlessConfig'

describe('endlessConfig (Ver.6 Phase 4.2 再々設計: 初級=0〜120%代表／中級=FINAL／上級=全部乗せ)', () => {
  describe('ENDLESS_BEGINNER_PHASE (0〜120%全体を代表する合成プール)', () => {
    it('pool is the union of all 6 normal-game DIFFICULTY_PHASES pools (not a single phase)', () => {
      const expectedUnion = new Set(DIFFICULTY_PHASES.flatMap((p) => p.pool))
      expect(new Set(ENDLESS_BEGINNER_PHASE.pool)).toEqual(expectedUnion)
    })

    it('is strictly broader than any single phase (not just warmup, ramp, or overload alone)', () => {
      for (const phase of DIFFICULTY_PHASES) {
        expect(ENDLESS_BEGINNER_PHASE.pool.length).toBeGreaterThanOrEqual(phase.pool.length)
      }
    })

    it('speedMultiplier is the plain average of all 6 phases (a representative value, not borrowed from one phase)', () => {
      const expectedAvg = DIFFICULTY_PHASES.reduce((sum, p) => sum + p.speedMultiplier, 0) / DIFFICULTY_PHASES.length
      expect(ENDLESS_BEGINNER_PHASE.speedMultiplier).toBeCloseTo(expectedAvg, 10)
    })

    it('has no weightedTypes (does not artificially bias toward hard types)', () => {
      expect(ENDLESS_BEGINNER_PHASE.weightedTypes).toBeUndefined()
    })

    it('bgm stage index is a representative mid value within the normal 0-5 stage range', () => {
      expect(ENDLESS_BEGINNER_BGM_STAGE_INDEX).toBeGreaterThanOrEqual(0)
      expect(ENDLESS_BEGINNER_BGM_STAGE_INDEX).toBeLessThanOrEqual(DIFFICULTY_PHASES.length - 1)
    })
  })

  it('FINAL_POOL_TIERS covers the 4 real FINAL DOPA TRIAL tiers used by both intermediate and advanced', () => {
    expect(new Set(FINAL_POOL_TIERS)).toEqual(new Set(['reversal', 'twoCondition', 'memory', 'mixed']))
    expect(FINAL_POOL_TIERS.length).toBe(4)
  })

  it('has a Japanese label for every difficulty', () => {
    for (const d of ENDLESS_DIFFICULTIES) {
      expect(ENDLESS_DIFFICULTY_LABEL[d].length).toBeGreaterThan(0)
    }
  })

  describe('isEndlessMilestone / endlessMilestoneLevel', () => {
    it('10/20/30/50 are milestones; values in between are not', () => {
      expect(isEndlessMilestone(10)).toBe(true)
      expect(isEndlessMilestone(20)).toBe(true)
      expect(isEndlessMilestone(30)).toBe(true)
      expect(isEndlessMilestone(50)).toBe(true)
      expect(isEndlessMilestone(1)).toBe(false)
      expect(isEndlessMilestone(11)).toBe(false)
      expect(isEndlessMilestone(49)).toBe(false)
    })

    it('every multiple of 50 beyond 50 is also a milestone', () => {
      expect(isEndlessMilestone(100)).toBe(true)
      expect(isEndlessMilestone(150)).toBe(true)
      expect(isEndlessMilestone(75)).toBe(false)
    })

    it('milestone level increases (never decreases) as streak grows', () => {
      const streaks = [10, 15, 20, 25, 30, 40, 50, 80, 100, 200]
      let prevLevel = 0
      for (const s of streaks) {
        const level = endlessMilestoneLevel(s)
        expect(level).toBeGreaterThanOrEqual(prevLevel)
        prevLevel = level
      }
    })

    it('level stays within the 1-5 range accepted by sfx.comboMilestone / sfx.endlessCorrect', () => {
      for (const s of [1, 10, 20, 30, 50, 100, 1000]) {
        const level = endlessMilestoneLevel(s)
        expect(level).toBeGreaterThanOrEqual(1)
        expect(level).toBeLessThanOrEqual(5)
      }
    })
  })
})
