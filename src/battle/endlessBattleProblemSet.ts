import { CHALLENGE500_ENDLESS_TIERS, CHALLENGE500_TIER_REPRESENTATIVE_PERCENT, pickEndlessAdvancedOrigin, type EndlessAdvancedOrigin } from '../engine/endlessAdvancedPicker'
import { endlessSlotToProblemSetItem } from '../engine/endlessReplay'
import { pickFinalQuestion } from '../engine/finalQuestionPicker'
import { generateNextQuestion } from '../engine/questionPicker'
import { pick } from '../engine/random'
import type { EndlessQuestionSlot } from '../engine/useEndlessGame'
import { ENDLESS_BEGINNER_PHASE, FINAL_POOL_TIERS } from '../config/endlessConfig'
import { pickChallenge500Question } from '../questions/challenge500'
import type { ChallengeProblemSetItem } from '../challenge/types'
import type { EndlessDifficulty, FinalQuestionTag, QuestionTypeId } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM ENDLESS）: PRIVATE ROOMの
 * ENDLESS対戦で両プレイヤーに配布する、サーバー側で1回だけ確定した共通問題列。
 *
 * ENDLESS Challenge（challenge/endlessChallenge.ts）は「ホストが実際に1人でプレイした
 * 記録」をそのまま再利用できたが、PRIVATE ROOMのENDLESS対戦には「元になる1人プレイ」が
 * 存在しない（同時に2人が初めて挑む——battle/battleProblemSet.tsのNORMAL対戦と同じ事情）。
 * そのため、ここでuseEndlessGame.ts内部のbuildRandomNext()と全く同じ分岐
 * （beginner=generateNextQuestion、intermediate=pickFinalQuestion、
 * advanced=pickEndlessAdvancedOriginによるfinal/challenge500混在）を踏襲した駆動ループだけを
 * 新規に書き、実際の出題選択ロジック自体は一切複製しない。各問題は既存の
 * endlessSlotToProblemSetItem（ENDLESS Challengeのreplay機構で実績あり）でそのまま
 * ChallengeProblemSetItemへ変換するため、useEndlessGame.tsのreplayQuestionsオプションに
 * そのまま渡せる（両プレイヤーのEndlessPlayScreenが、ここで生成した同一配列を同一順序で
 * 消費する）。
 *
 * ENDLESS_BATTLE_PROBLEM_COUNTは、既存のENDLESS Challenge（useEndlessGame.ts
 * MAX_RECORDED_PROBLEMS=300）と同じ値にそろえている。この配列を使い切った場合、
 * useEndlessGame.ts側の既存フォールバック（各プレイヤーが独立にbuildRandomNext()へ
 * 切り替える）がそのまま働く——これはENDLESS Challengeが本番で既に許容している、
 * 「300連続を超える超長時間プレイでは以後の問題が両者で一致しなくなる」という既知の
 * 受容済みエッジケースと同一であり、PRIVATE ROOM専用の新しい問題ではない。
 */
export const ENDLESS_BATTLE_PROBLEM_COUNT = 300

const RECENT_TYPES_LENGTH = 3

function buildEndlessBattleSlot(
  difficulty: EndlessDifficulty,
  recentNormalTypes: QuestionTypeId[],
  recentFinalTypes: string[],
  recentFinalTags: FinalQuestionTag[],
  recentChallenge500Type: { current: string | null },
  recentAdvancedOrigins: EndlessAdvancedOrigin[],
): EndlessQuestionSlot {
  if (difficulty === 'beginner') {
    const spec = generateNextQuestion(ENDLESS_BEGINNER_PHASE, recentNormalTypes)
    return { kind: 'normal', spec }
  }
  if (difficulty === 'intermediate') {
    const tier = pick(FINAL_POOL_TIERS)
    const spec = pickFinalQuestion(tier, recentFinalTypes, recentFinalTags)
    return { kind: 'final', spec }
  }
  const origin = pickEndlessAdvancedOrigin(recentAdvancedOrigins)
  if (origin === 'final') {
    const tier = pick(FINAL_POOL_TIERS)
    const spec = pickFinalQuestion(tier, recentFinalTypes, recentFinalTags)
    return { kind: 'final', spec }
  }
  const tier = pick(CHALLENGE500_ENDLESS_TIERS)
  const percent = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]
  const spec = pickChallenge500Question(percent, recentChallenge500Type.current)
  return { kind: 'challenge500', spec, tier }
}

export function generateEndlessBattleProblemSet(difficulty: EndlessDifficulty, count: number = ENDLESS_BATTLE_PROBLEM_COUNT): ChallengeProblemSetItem[] {
  const recentNormalTypes: QuestionTypeId[] = []
  const recentFinalTypes: string[] = []
  let recentFinalTags: FinalQuestionTag[] = []
  const recentChallenge500Type = { current: null as string | null }
  const recentAdvancedOrigins: EndlessAdvancedOrigin[] = []

  const items: ChallengeProblemSetItem[] = []
  for (let i = 0; i < count; i++) {
    const slot = buildEndlessBattleSlot(difficulty, recentNormalTypes, recentFinalTypes, recentFinalTags, recentChallenge500Type, recentAdvancedOrigins)
    if (slot.kind === 'normal') {
      recentNormalTypes.unshift(slot.spec.type)
      recentNormalTypes.length = Math.min(recentNormalTypes.length, RECENT_TYPES_LENGTH)
    } else if (slot.kind === 'final') {
      recentFinalTypes.unshift(slot.spec.type)
      recentFinalTypes.length = Math.min(recentFinalTypes.length, RECENT_TYPES_LENGTH)
      recentFinalTags = slot.spec.tags
      recentAdvancedOrigins.unshift('final')
      recentAdvancedOrigins.length = Math.min(recentAdvancedOrigins.length, RECENT_TYPES_LENGTH)
    } else {
      recentChallenge500Type.current = slot.spec.type
      recentAdvancedOrigins.unshift('challenge500')
      recentAdvancedOrigins.length = Math.min(recentAdvancedOrigins.length, RECENT_TYPES_LENGTH)
    }
    items.push(endlessSlotToProblemSetItem(slot))
  }
  return items
}
