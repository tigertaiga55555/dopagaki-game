import { describe, expect, it } from 'vitest'
import { ENDLESS_BEGINNER_PHASE, FINAL_POOL_TIERS } from '../config/endlessConfig'
import { CHALLENGE500_TIER_REPRESENTATIVE_PERCENT } from './endlessAdvancedPicker'
import { generateNextQuestion } from './questionPicker'
import { pickFinalQuestion } from './finalQuestionPicker'
import { CHALLENGE500_QUESTION_MODULES, pickChallenge500Question } from '../questions/challenge500'
import { pick } from './random'
import { FINAL_QUESTION_POOLS, ULTIMATE_QUESTION_POOL } from '../questions/final'
import type { FinalQuestionTag, QuestionTypeId } from '../types'
import type { PromptSegment } from '../components/InversionPrompt'

const DRAWS = 300

const FINAL_IDS = new Set(
  [...FINAL_QUESTION_POOLS.reversal, ...FINAL_QUESTION_POOLS.twoCondition, ...FINAL_QUESTION_POOLS.memory, ...FINAL_QUESTION_POOLS.mixed].map(
    (m) => m.id,
  ),
)
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

describe('Endless question pool mapping (Ver.6 Phase 4.2 再々設計)', () => {
  describe('初級: 0〜120%相当（ENDLESS_BEGINNER_PHASE）', () => {
    it('never produces a FINAL DOPA TRIAL question id', () => {
      let recent: QuestionTypeId[] = []
      for (let i = 0; i < DRAWS; i++) {
        const spec = generateNextQuestion(ENDLESS_BEGINNER_PHASE, recent)
        expect(FINAL_IDS.has(spec.type)).toBe(false)
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

  describe('中級: FINAL DOPA TRIAL 120〜200%相当', () => {
    it('produces real FINAL DOPA TRIAL question ids (reversal/twoCondition/memory/mixed), never the Q16-only ULTIMATE pool', () => {
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      for (let i = 0; i < DRAWS; i++) {
        const tier = pick(FINAL_POOL_TIERS)
        const spec = pickFinalQuestion(tier, recentTypes, recentTags)
        expect(FINAL_IDS.has(spec.type)).toBe(true)
        expect(ULTIMATE_IDS.has(spec.type)).toBe(false)
        recentTypes = [spec.type, ...recentTypes].slice(0, 3)
        recentTags = spec.tags
      }
    })

    it('never produces a Challenge500 question id', () => {
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      for (let i = 0; i < DRAWS; i++) {
        const tier = pick(FINAL_POOL_TIERS)
        const spec = pickFinalQuestion(tier, recentTypes, recentTags)
        expect(CHALLENGE500_IDS.has(spec.type)).toBe(false)
        recentTypes = [spec.type, ...recentTypes].slice(0, 3)
        recentTags = spec.tags
      }
    })
  })

  describe('上級: 120〜500%相当の全部乗せ（FINAL ＋ Challenge500）', () => {
    it('produces FINAL DOPA TRIAL question ids across many draws', () => {
      let recentTypes: string[] = []
      let recentTags: FinalQuestionTag[] = []
      let sawFinal = false
      for (let i = 0; i < DRAWS; i++) {
        const tier = pick(FINAL_POOL_TIERS)
        const spec = pickFinalQuestion(tier, recentTypes, recentTags)
        if (FINAL_IDS.has(spec.type)) sawFinal = true
        recentTypes = [spec.type, ...recentTypes].slice(0, 3)
        recentTags = spec.tags
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
      // 代表％がtierForPercentで意図通り1/2/3へ解決されることは、
      // engine/endlessAdvancedPicker.tsのモジュール読み込み時assertでも保証されている。
      // ここでは実際に生成されるデータのtier依存挙動（tier1はinversion<=1のみ）で裏付ける。
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
