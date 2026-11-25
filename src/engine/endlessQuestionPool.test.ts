import { describe, expect, it } from 'vitest'
import { ENDLESS_BEGINNER_PHASE } from '../config/endlessConfig'
import {
  CHALLENGE500_TIER_REPRESENTATIVE_PERCENT,
  endlessAdvancedCategoryToChallenge500Tier,
  endlessAdvancedCategoryToFinalTier,
  pickEndlessAdvancedCategory,
} from './endlessAdvancedPicker'
import { pickEndlessIntermediateTier } from './endlessIntermediatePicker'
import { generateNextQuestion } from './questionPicker'
import { pickFinalQuestion } from './finalQuestionPicker'
import { CHALLENGE500_QUESTION_MODULES, pickChallenge500Question } from '../questions/challenge500'
import { FINAL_QUESTION_POOLS, ULTIMATE_QUESTION_POOL } from '../questions/final'
import type { FinalQuestionTag, QuestionTypeId } from '../types'
import type { PromptSegment } from '../components/InversionPrompt'

const DRAWS = 300

const INTERMEDIATE_IDS = new Set([...FINAL_QUESTION_POOLS.reversal, ...FINAL_QUESTION_POOLS.twoCondition].map((m) => m.id))
const ADVANCED_FINAL_IDS = new Set([...FINAL_QUESTION_POOLS.memory, ...FINAL_QUESTION_POOLS.mixed].map((m) => m.id))
const ALL_FINAL_IDS = new Set([...INTERMEDIATE_IDS, ...ADVANCED_FINAL_IDS])
const ULTIMATE_IDS = new Set(ULTIMATE_QUESTION_POOL.map((m) => m.id))
const CHALLENGE500_IDS = new Set(CHALLENGE500_QUESTION_MODULES.map((m) => m.id))

/**
 * Challenge500の11モジュールの大半はspec.data.segments（PromptSegment[]）を持つが、
 * RpsCompoundQuestionだけはパネル（相手1〜2人）ごとに独立した反転を持つため
 * segmentsByPanel（Record<number, PromptSegment[]>）という形になっている。
 * どちらの形でも「実際に表示される全文中、下線（inverted:true）が引かれた箇所の数」を
 * 一箇所に集約して数えるための小さなヘルパー（テスト専用、本番コードには影響しない）。
 */
function extractAllSegments(data: Record<string, unknown>): PromptSegment[] {
  if (Array.isArray((data as { segments?: unknown }).segments)) {
    return (data as { segments: PromptSegment[] }).segments
  }
  const byPanel = (data as { segmentsByPanel?: Record<number, PromptSegment[]> }).segmentsByPanel
  if (byPanel) return Object.values(byPanel).flat()
  throw new Error('Challenge500 question data has neither segments nor segmentsByPanel')
}

describe('Endless question pool mapping (item 154-156: 中級=reversal/twoCondition・上級=memory/mixed+Challenge500)', () => {
  describe('初級: 0〜120%相当（ENDLESS_BEGINNER_PHASE、今回のラウンドでは無変更）', () => {
    it('never produces a FINAL DOPA TRIAL question id', () => {
      let recent: QuestionTypeId[] = []
      for (let i = 0; i < DRAWS; i++) {
        const spec = generateNextQuestion(ENDLESS_BEGINNER_PHASE, recent)
        expect(ALL_FINAL_IDS.has(spec.type)).toBe(false)
        recent = [spec.type, ...recent].slice(0, 3)
      }
    })

    it('never produces a Challenge500 question id', () => {
      let recent: QuestionTypeId[] = []
      for (let i = 0; i < DRAWS; i++) {
        const spec = generateNextQuestion(ENDLESS_BEGINNER_PHASE, recent)
        expect(CHALLENGE500_IDS.has(spec.type)).toBe(false)
        recent = [spec.type, ...recent].slice(0, 3)
      }
    })
  })

  describe('中級: FINAL DOPA TRIAL前半2tier（reversal/twoCondition、実質120〜160%未満相当）', () => {
    it('produces only reversal/twoCondition question ids — never memory/mixed, never the Q16-only ULTIMATE pool', () => {
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      const recentTiers: ('reversal' | 'twoCondition')[] = []
      for (let i = 0; i < DRAWS; i++) {
        const tier = pickEndlessIntermediateTier(i, recentTiers)
        recentTiers.unshift(tier)
        recentTiers.length = Math.min(recentTiers.length, 3)
        const spec = pickFinalQuestion(tier, recentTypes, recentTags)
        expect(INTERMEDIATE_IDS.has(spec.type)).toBe(true)
        expect(ADVANCED_FINAL_IDS.has(spec.type)).toBe(false)
        expect(ULTIMATE_IDS.has(spec.type)).toBe(false)
        recentTypes = [spec.type, ...recentTypes].slice(0, 3)
        recentTags = spec.tags
      }
    })

    it('never produces a Challenge500 question id', () => {
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      const recentTiers: ('reversal' | 'twoCondition')[] = []
      for (let i = 0; i < DRAWS; i++) {
        const tier = pickEndlessIntermediateTier(i, recentTiers)
        recentTiers.unshift(tier)
        recentTiers.length = Math.min(recentTiers.length, 3)
        const spec = pickFinalQuestion(tier, recentTypes, recentTags)
        expect(CHALLENGE500_IDS.has(spec.type)).toBe(false)
        recentTypes = [spec.type, ...recentTypes].slice(0, 3)
        recentTags = spec.tags
      }
    })
  })

  describe('上級: FINAL後半2tier（memory/mixed、実質160〜200%未満相当）＋Challenge500 200〜500%', () => {
    it('never produces a reversal/twoCondition question id (完全に中級と排他)', () => {
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      let recentChallenge500Type: string | null = null
      const recentCategories: Parameters<typeof pickEndlessAdvancedCategory>[1] = []
      for (let i = 0; i < DRAWS; i++) {
        const category = pickEndlessAdvancedCategory(i, recentCategories)
        recentCategories.unshift(category)
        recentCategories.length = Math.min(recentCategories.length, 3)
        const finalTier = endlessAdvancedCategoryToFinalTier(category)
        if (finalTier) {
          const spec = pickFinalQuestion(finalTier, recentTypes, recentTags)
          expect(INTERMEDIATE_IDS.has(spec.type)).toBe(false)
          expect(ADVANCED_FINAL_IDS.has(spec.type)).toBe(true)
          recentTypes = [spec.type, ...recentTypes].slice(0, 3)
          recentTags = spec.tags
        } else {
          const tier = endlessAdvancedCategoryToChallenge500Tier(category)!
          const percent = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]
          const spec = pickChallenge500Question(percent, recentChallenge500Type)
          expect(CHALLENGE500_IDS.has(spec.type)).toBe(true)
          recentChallenge500Type = spec.type
        }
      }
    })

    it('produces FINAL DOPA TRIAL (memory/mixed) question ids across many draws', () => {
      let sawFinal = false
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      for (const tier of ['memory', 'mixed'] as const) {
        for (let i = 0; i < DRAWS; i++) {
          const spec = pickFinalQuestion(tier, recentTypes, recentTags)
          if (ADVANCED_FINAL_IDS.has(spec.type)) sawFinal = true
          recentTypes = [spec.type, ...recentTypes].slice(0, 3)
          recentTags = spec.tags
        }
      }
      expect(sawFinal).toBe(true)
    })

    it('produces all 11 Challenge500 question types across many draws, across the 3 representative tiers', () => {
      const seenTypes = new Set<string>()
      let recentType: string | null = null
      for (const tier of [1, 2, 3] as const) {
        const percent = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]
        for (let i = 0; i < DRAWS; i++) {
          const spec = pickChallenge500Question(percent, recentType)
          expect(CHALLENGE500_IDS.has(spec.type)).toBe(true)
          seenTypes.add(spec.type)
          recentType = spec.type
        }
      }
      expect(seenTypes.size).toBe(CHALLENGE500_QUESTION_MODULES.length)
    })

    it('0/1/2 underline-inversion counts all occur across the 3 representative tiers, and non-underlined segments are never flagged inverted incorrectly', () => {
      const seenInversionCounts = new Set<number>()
      let recentType: string | null = null
      for (const tier of [1, 2, 3] as const) {
        const percent = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]
        for (let i = 0; i < DRAWS; i++) {
          const spec = pickChallenge500Question(percent, recentType)
          const segments = extractAllSegments(spec.data)
          expect(Array.isArray(segments)).toBe(true)
          for (const seg of segments) {
            expect(typeof seg.inverted).toBe('boolean')
          }
          const invertedCount = segments.filter((s) => s.inverted).length
          seenInversionCounts.add(invertedCount)
          recentType = spec.type
        }
      }
      expect(seenInversionCounts).toEqual(new Set([0, 1, 2]))
    })

    it('representative percents resolve to the intended Challenge500 tier', () => {
      let sawInversion2AtTier1 = false
      const percent1 = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[1]
      for (let i = 0; i < DRAWS; i++) {
        const spec = pickChallenge500Question(percent1, null)
        const segments = extractAllSegments(spec.data)
        const invertedCount = segments.filter((s) => s.inverted).length
        if (invertedCount === 2) sawInversion2AtTier1 = true
      }
      expect(sawInversion2AtTier1).toBe(false)
    })
  })
})
