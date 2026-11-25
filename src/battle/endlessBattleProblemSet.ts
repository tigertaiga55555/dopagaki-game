import {
  CHALLENGE500_TIER_REPRESENTATIVE_PERCENT,
  endlessAdvancedCategoryToChallenge500Tier,
  endlessAdvancedCategoryToFinalTier,
  pickEndlessAdvancedCategory,
  type EndlessAdvancedCategory,
} from '../engine/endlessAdvancedPicker'
import { pickEndlessIntermediateTier, type EndlessIntermediateTier } from '../engine/endlessIntermediatePicker'
import { endlessSlotToProblemSetItem } from '../engine/endlessReplay'
import { pickFinalQuestion } from '../engine/finalQuestionPicker'
import { generateNextQuestion } from '../engine/questionPicker'
import type { EndlessQuestionSlot } from '../engine/useEndlessGame'
import { ENDLESS_BEGINNER_PHASE } from '../config/endlessConfig'
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
 * （beginner=generateNextQuestion、intermediate=pickEndlessIntermediateTier、
 * advanced=pickEndlessAdvancedCategoryによるmemory/mixed/challenge500混在、item 154-156で
 * STREAK連動の重みへ改訂）を踏襲した駆動ループだけを新規に書き、実際の出題選択ロジック
 * 自体は一切複製しない。各問題は既存の
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

/**
 * 次フェーズ（item 154-156）: useEndlessGame.ts（実プレイ）と同じく、中級=reversal/
 * twoCondition・上級=memory/mixed+Challenge500 tier1/2/3のstreak連動重みを使う。
 * この問題列は「対戦開始前に1回だけ確定させる静的な配列」のため、ここでの
 * streak代用値は「今までに何問を確定させたか」（＝ループのi、実プレイでの
 * 既に積み上げたstreakと同じ意味）をそのまま使う。
 */
function unshiftCapped<T>(arr: T[], value: T): void {
  arr.unshift(value)
  arr.length = Math.min(arr.length, RECENT_TYPES_LENGTH)
}

function buildEndlessBattleSlot(
  difficulty: EndlessDifficulty,
  streak: number,
  recentNormalTypes: QuestionTypeId[],
  recentFinalTypes: string[],
  recentFinalTags: FinalQuestionTag[],
  recentChallenge500Type: { current: string | null },
  recentIntermediateTiers: EndlessIntermediateTier[],
  recentAdvancedCategories: EndlessAdvancedCategory[],
): EndlessQuestionSlot {
  if (difficulty === 'beginner') {
    const spec = generateNextQuestion(ENDLESS_BEGINNER_PHASE, recentNormalTypes)
    return { kind: 'normal', spec }
  }
  if (difficulty === 'intermediate') {
    const tier = pickEndlessIntermediateTier(streak, recentIntermediateTiers)
    unshiftCapped(recentIntermediateTiers, tier)
    const spec = pickFinalQuestion(tier, recentFinalTypes, recentFinalTags)
    return { kind: 'final', spec }
  }
  const category = pickEndlessAdvancedCategory(streak, recentAdvancedCategories)
  unshiftCapped(recentAdvancedCategories, category)
  const finalTier = endlessAdvancedCategoryToFinalTier(category)
  if (finalTier) {
    const spec = pickFinalQuestion(finalTier, recentFinalTypes, recentFinalTags)
    return { kind: 'final', spec }
  }
  const tier = endlessAdvancedCategoryToChallenge500Tier(category)!
  const percent = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]
  const spec = pickChallenge500Question(percent, recentChallenge500Type.current)
  return { kind: 'challenge500', spec, tier }
}

export function generateEndlessBattleProblemSet(difficulty: EndlessDifficulty, count: number = ENDLESS_BATTLE_PROBLEM_COUNT): ChallengeProblemSetItem[] {
  const recentNormalTypes: QuestionTypeId[] = []
  const recentFinalTypes: string[] = []
  let recentFinalTags: FinalQuestionTag[] = []
  const recentChallenge500Type = { current: null as string | null }
  const recentIntermediateTiers: EndlessIntermediateTier[] = []
  const recentAdvancedCategories: EndlessAdvancedCategory[] = []

  const items: ChallengeProblemSetItem[] = []
  for (let i = 0; i < count; i++) {
    const slot = buildEndlessBattleSlot(
      difficulty,
      i,
      recentNormalTypes,
      recentFinalTypes,
      recentFinalTags,
      recentChallenge500Type,
      recentIntermediateTiers,
      recentAdvancedCategories,
    )
    if (slot.kind === 'normal') {
      unshiftCapped(recentNormalTypes, slot.spec.type)
    } else if (slot.kind === 'final') {
      unshiftCapped(recentFinalTypes, slot.spec.type)
      recentFinalTags = slot.spec.tags
    } else {
      recentChallenge500Type.current = slot.spec.type
    }
    items.push(endlessSlotToProblemSetItem(slot))
  }
  return items
}
