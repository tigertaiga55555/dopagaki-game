import { describe, expect, it } from 'vitest'
import { DIFFICULTY_PHASES } from './difficultyConfig'
import {
  ENDLESS_DIFFICULTIES,
  ENDLESS_DIFFICULTY_LABEL,
  FINAL_POOL_TIERS,
  endlessMilestoneLevel,
  getEndlessBgmStageIndex,
  getEndlessPhase,
  isEndlessMilestone,
} from './endlessConfig'

describe('endlessConfig', () => {
  it('beginner/intermediate map to existing normal-game DIFFICULTY_PHASES entries (no duplicate difficulty system)', () => {
    for (const difficulty of ['beginner', 'intermediate'] as const) {
      const phase = getEndlessPhase(difficulty)
      expect(DIFFICULTY_PHASES).toContain(phase)
    }
  })

  it('beginner maps to ramp, intermediate maps to overload (the new, more clearly differentiated mapping)', () => {
    expect(getEndlessPhase('beginner').id).toBe('ramp')
    expect(getEndlessPhase('intermediate').id).toBe('overload')
  })

  it('intermediate (overload) is clearly harder than beginner (ramp): broader pool, faster speed, weighted hard types', () => {
    const beginner = getEndlessPhase('beginner')
    const intermediate = getEndlessPhase('intermediate')
    expect(intermediate.pool.length).toBeGreaterThan(beginner.pool.length)
    expect(intermediate.speedMultiplier).toBeLessThan(beginner.speedMultiplier)
    expect(beginner.weightedTypes).toBeUndefined()
    expect(intermediate.weightedTypes).toBeDefined()
  })

  it('beginner pool never includes the fake-zone/overload-exclusive trick types', () => {
    const beginner = getEndlessPhase('beginner')
    const overloadOnlyTypes = ['colorWord', 'shortVideoSwipe', 'releaseZone', 'reverseArrowSwipe', 'popTarget', 'rps', 'moreSide', 'fewerSide', 'biggerShape', 'holdPress', 'notifRush', 'dragGoal', 'sameOne']
    for (const t of overloadOnlyTypes) {
      expect(beginner.pool).not.toContain(t)
    }
  })

  it('has a Japanese label for every difficulty', () => {
    for (const d of ENDLESS_DIFFICULTIES) {
      expect(ENDLESS_DIFFICULTY_LABEL[d].length).toBeGreaterThan(0)
    }
  })

  it('bgm stage index corresponds to the phase position within DIFFICULTY_PHASES (beginner/intermediate only)', () => {
    for (const d of ['beginner', 'intermediate'] as const) {
      const phase = getEndlessPhase(d)
      const expectedIndex = DIFFICULTY_PHASES.findIndex((p) => p.id === phase.id)
      expect(getEndlessBgmStageIndex(d)).toBe(expectedIndex)
    }
  })

  it('advanced uses the 4 real FINAL DOPA TRIAL tier pools (reversal/twoCondition/memory/mixed), not a DIFFICULTY_PHASES entry', () => {
    expect(new Set(FINAL_POOL_TIERS)).toEqual(new Set(['reversal', 'twoCondition', 'memory', 'mixed']))
    expect(FINAL_POOL_TIERS.length).toBe(4)
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
