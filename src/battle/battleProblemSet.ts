import { TOTAL_GAME_SEC, getPhaseAt } from '../config/difficultyConfig'
import { TIMING_SAFETY } from '../config/timingConfig'
import { generateNextQuestion } from '../engine/questionPicker'
import { randFloat } from '../engine/random'
import { specToProblemSetItem } from '../engine/useRushGame'
import { QUESTION_MODULES } from '../questions'
import type { ChallengeProblemSetItem } from '../challenge/types'
import type { QuestionSpec, QuestionTypeId } from '../types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: BattleRoom（サーバー側）が試合開始前に1回だけ
 * 生成する、両プレイヤー共通のProblemSet。
 *
 * Challenge機能は「作成者が実際に1人でプレイした記録」をそのまま再利用できたが、
 * Battleには「元になる1人プレイ」が存在しない（同時に2人が初めて挑む）ため、サーバー側で
 * 新規に問題列を確定する必要がある。ここで使う出題ロジック（generateNextQuestion・
 * getPhaseAt・QUESTION_MODULES.bonusTime）は、通常プレイ（useRushGame.ts）が実際に使っている
 * ものと完全に同一の関数で、Battle専用の別実装は一切作っていない——作っているのは
 * 「経過秒の近似値を進めながら同じ関数を呼ぶ」という駆動ループ（このファイル）だけ。
 *
 * 経過秒は実測（人間の反応待ち）ではなく一定歩幅の近似値を使う。これは出題タイプの
 * 難易度カーブ（フェーズ選択）をおおよそ時間経過どおりに進めるためだけの近似であり、
 * 「同じ問題・同じ順番を両者に配る」という本質的な要件には影響しない
 * （両プレイヤーは常にこの同一配列を同一順序で受け取る）。
 */
const RECENT_TYPES_LENGTH = 3
/** 60秒の通常フェーズ＋FINAL DOPA TRIAL深部まで十分な余裕を持つ問題数。使い切った場合は
 *  既存のreplayQuestions消費ロジック（useRushGame.ts/useFinalTrial.ts）が通常の抽選へ
 *  自動フォールバックする（Challengeの既存挙動と同じ、新しい問題は両者が独立に受け取る）。 */
const BATTLE_PROBLEM_COUNT = 260
/** 1問あたりの経過秒の近似歩幅（60秒・典型50〜60問 run を想定した近似値）。 */
const AVG_SEC_PER_QUESTION = TOTAL_GAME_SEC / 55
/** DOPA BONUS TIMEの発生ウィンドウ。useRushGame.tsの本番スケジューリングと同じ範囲。 */
const BONUS_TIME_WINDOW_START_SEC = 25
const BONUS_TIME_WINDOW_END_SEC = 40

function buildBonusTimeSpec(phaseSpeedMultiplier: number, index: number): QuestionSpec {
  const module = QUESTION_MODULES.bonusTime
  const data = module.generate()
  const scaledBase = module.baseTargetTimeMs * phaseSpeedMultiplier
  const minRequired = Math.max(TIMING_SAFETY.absoluteFloorMs, module.computeMinTargetTimeMs?.(data) ?? 0)
  const targetTimeMs = Math.round(Math.max(scaledBase, minRequired))
  return { instanceId: `battle-bonus-${index}`, type: 'bonusTime', targetTimeMs, data }
}

export function generateBattleProblemSet(): ChallengeProblemSetItem[] {
  const recentTypes: QuestionTypeId[] = []
  const items: ChallengeProblemSetItem[] = []
  const bonusAtSec = randFloat(BONUS_TIME_WINDOW_START_SEC, BONUS_TIME_WINDOW_END_SEC)
  const bonusIndex = Math.round(bonusAtSec / AVG_SEC_PER_QUESTION)

  for (let i = 0; i < BATTLE_PROBLEM_COUNT; i++) {
    const elapsedSec = i * AVG_SEC_PER_QUESTION
    const phase = getPhaseAt(elapsedSec)
    const spec = i === bonusIndex ? buildBonusTimeSpec(phase.speedMultiplier, i) : generateNextQuestion(phase, recentTypes)
    recentTypes.unshift(spec.type)
    recentTypes.length = Math.min(recentTypes.length, RECENT_TYPES_LENGTH)
    items.push(specToProblemSetItem(spec))
  }
  return items
}
