import { describe, expect, it } from 'vitest'
import { DIFFICULTY_PHASES } from './difficultyConfig'
import {
  ENDLESS_DIFFICULTIES,
  ENDLESS_DIFFICULTY_LABEL,
  endlessMilestoneLevel,
  getEndlessBgmStageIndex,
  getEndlessPhase,
  isEndlessMilestone,
} from './endlessConfig'

describe('endlessConfig', () => {
  it('each of the 3 difficulties maps to one of the existing normal-game DIFFICULTY_PHASES (no duplicate difficulty system)', () => {
    for (const difficulty of ENDLESS_DIFFICULTIES) {
      const phase = getEndlessPhase(difficulty)
      expect(DIFFICULTY_PHASES).toContain(phase)
    }
  })

  it('beginner/intermediate/advanced map to 3 distinct phases with distinct pools and speeds (not the same bucket)', () => {
    const phases = ENDLESS_DIFFICULTIES.map((d) => getEndlessPhase(d))
    const ids = new Set(phases.map((p) => p.id))
    expect(ids.size).toBe(3)
    const speeds = phases.map((p) => p.speedMultiplier)
    expect(new Set(speeds).size).toBe(3)
  })

  it('advanced is strictly harder (lower speedMultiplier = less time) than beginner', () => {
    const beginner = getEndlessPhase('beginner')
    const advanced = getEndlessPhase('advanced')
    expect(advanced.speedMultiplier).toBeLessThan(beginner.speedMultiplier)
  })

  it('has a Japanese label for every difficulty', () => {
    for (const d of ENDLESS_DIFFICULTIES) {
      expect(ENDLESS_DIFFICULTY_LABEL[d].length).toBeGreaterThan(0)
    }
  })

  it('bgm stage index corresponds to the phase position within DIFFICULTY_PHASES', () => {
    for (const d of ENDLESS_DIFFICULTIES) {
      const phase = getEndlessPhase(d)
      const expectedIndex = DIFFICULTY_PHASES.findIndex((p) => p.id === phase.id)
      expect(getEndlessBgmStageIndex(d)).toBe(expectedIndex)
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

    it('level stays within the 1-5 range accepted by sfx.comboMilestone', () => {
      for (const s of [1, 10, 20, 30, 50, 100, 1000]) {
        const level = endlessMilestoneLevel(s)
        expect(level).toBeGreaterThanOrEqual(1)
        expect(level).toBeLessThanOrEqual(5)
      }
    })
  })
})
