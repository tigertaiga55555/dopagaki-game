import { describe, expect, it } from 'vitest'
import { FINAL_POOL_TIERS, getEndlessPhase } from '../config/endlessConfig'
import { generateNextQuestion } from './questionPicker'
import { pickFinalQuestion } from './finalQuestionPicker'
import { pick } from './random'
import { FINAL_QUESTION_POOLS, ULTIMATE_QUESTION_POOL } from '../questions/final'
import type { FinalQuestionTag, QuestionTypeId } from '../types'

const DRAWS = 300

describe('Endless question pool mapping (Ver.6 Phase 4.1 re-design)', () => {
  it('beginner (ramp) only ever draws from ramp.pool across many random generations', () => {
    const phase = getEndlessPhase('beginner')
    const allowed = new Set(phase.pool)
    let recent: QuestionTypeId[] = []
    for (let i = 0; i < DRAWS; i++) {
      const spec = generateNextQuestion(phase, recent)
      expect(allowed.has(spec.type)).toBe(true)
      recent = [spec.type, ...recent].slice(0, 3)
    }
  })

  it('intermediate (overload) only ever draws from overload.pool across many random generations', () => {
    const phase = getEndlessPhase('intermediate')
    const allowed = new Set(phase.pool)
    let recent: QuestionTypeId[] = []
    for (let i = 0; i < DRAWS; i++) {
      const spec = generateNextQuestion(phase, recent)
      expect(allowed.has(spec.type)).toBe(true)
      recent = [spec.type, ...recent].slice(0, 3)
    }
  })

  it('intermediate draws fake-zone/high-cognitive-load types that beginner never produces (visible difficulty gap)', () => {
    const intermediatePhase = getEndlessPhase('intermediate')
    const beginnerAllowed = new Set(getEndlessPhase('beginner').pool)
    const seenIntermediateOnly = new Set<QuestionTypeId>()
    let recent: QuestionTypeId[] = []
    for (let i = 0; i < DRAWS; i++) {
      const spec = generateNextQuestion(intermediatePhase, recent)
      if (!beginnerAllowed.has(spec.type)) seenIntermediateOnly.add(spec.type)
      recent = [spec.type, ...recent].slice(0, 3)
    }
    expect(seenIntermediateOnly.size).toBeGreaterThan(0)
  })

  it('advanced only ever draws real FINAL DOPA TRIAL module ids (reversal/twoCondition/memory/mixed), never the Q16-only ULTIMATE pool', () => {
    const ultimateIds = new Set(ULTIMATE_QUESTION_POOL.map((m) => m.id))
    const tierIds = new Set(
      ([...FINAL_QUESTION_POOLS.reversal, ...FINAL_QUESTION_POOLS.twoCondition, ...FINAL_QUESTION_POOLS.memory, ...FINAL_QUESTION_POOLS.mixed]).map(
        (m) => m.id,
      ),
    )
    let recentTypes: string[] = []
    let recentTags: FinalQuestionTag[] = []
    for (let i = 0; i < DRAWS; i++) {
      const tier = pick(FINAL_POOL_TIERS)
      const spec = pickFinalQuestion(tier, recentTypes, recentTags)
      expect(tierIds.has(spec.type)).toBe(true)
      expect(ultimateIds.has(spec.type)).toBe(false)
      recentTypes = [spec.type, ...recentTypes].slice(0, 3)
      recentTags = spec.tags
    }
  })

  it('advanced eventually draws from all 4 FINAL DOPA TRIAL tiers (reversal/twoCondition/memory/mixed) over many draws', () => {
    const seenTiers = new Set<string>()
    for (let i = 0; i < DRAWS; i++) {
      seenTiers.add(pick(FINAL_POOL_TIERS))
    }
    expect(seenTiers.size).toBe(4)
  })
})
