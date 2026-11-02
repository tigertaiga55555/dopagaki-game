import { DIFFICULTY_PHASES, type DifficultyPhase } from './difficultyConfig'
import type { EndlessDifficulty, FinalPoolTier } from '../types'

/**
 * Ver.6 Phase 4.1（難易度再設計）: Endlessモードの難易度（初級/中級/上級）定義。
 *
 * 【調査結果】旧実装はbeginner→warmup／intermediate→boost／advanced→finalRushという
 * 「DIFFICULTY_PHASESへの単純な1対1対応」だった。実機QAの結果、これでは3難易度の体感差が
 * 弱いと判明した。通常ゲームの難易度構造を再調査したところ：
 *
 * - 0〜120%帯（通常プレイ、config/difficultyConfig.ts）は経過時間で6フェーズが進行する：
 *   warmup(0-10s, 4種, ×1.15) → ramp(10-20s, 17種, ×1.0) → fake(20-30s, 24種, ×0.9) →
 *   boost(30-40s, 31種, ×0.78) → overload(40-50s, 32種+重み付け, ×0.68) →
 *   finalRush(50-60s, 32種+重み付け, ×0.58)。
 *   重要な事実：fakeフェーズのプール24種は全てoverloadフェーズのプール32種の部分集合であり、
 *   warmupの4種もrampの17種の部分集合。つまり「序盤レベル」はramp一つで、
 *   「0〜120%で最も難しい側」はoverload一つで、それぞれ過不足なく代表できる
 *   （finalRushはoverloadとほぼ同一プール＋repeatTap重み付けのみで、独立した性格を持たない）。
 * - 120〜200%帯は完全に別のFINAL DOPA TRIALエンジン（useFinalTrial.ts／
 *   engine/finalQuestionPicker.ts／questions/final/）が担当し、QuestionTypeIdの
 *   プールとは一切重ならない独立した問題群（reversal/twoCondition/memory/mixedの
 *   4階層、計38種のFinalQuestionModule）を使う。制限時間もフェーズ倍率を使わず、
 *   config/timingConfig.tsのTIMING_SAFETY.finalに定義された絶対値（2100〜3200ms）を
 *   そのまま使う——「速さで殺さず、認知の複雑さで殺す」設計。
 *
 * 【新しい対応】
 * - 初級 = ramp（0〜120%帯の序盤。基本問題中心・17種・速度標準）
 * - 中級 = overload（0〜120%帯の中でも明確に難しい側。32種・フェイク/認知負荷の高い
 *   タイプを重み付け・速度0.68倍。fakeゾーンの「フェイク」要素は全てこのプールに含まれる）
 * - 上級 = FINAL DOPA TRIAL（120〜200%で実際に使われている問題群をそのまま再利用。
 *   DIFFICULTY_PHASESの対象外——専用のFinalQuestionModuleを使うため、このファイルでは
 *   「どのtierプールから出すか」だけを管理する。ULTIMATE_QUESTION_POOL（Q16専用、
 *   16問目の一度きりの卒業試験プール）は含めない。通常のFINAL DOPA TRIALが反復プレイする
 *   Q1〜Q15相当のreversal/twoCondition/memory/mixedの4tierのみを使う）
 *
 * 新しい専用問題・新しい時間ルールは一切作らず、どちらも既存コードをそのまま再利用する。
 * （通常ゲーム0〜120%・FINAL DOPA TRIAL本体・500%チャレンジのコードには一切手を入れていない）
 */
export const ENDLESS_DIFFICULTY_PHASE_ID: Record<'beginner' | 'intermediate', DifficultyPhase['id']> = {
  beginner: 'ramp',
  intermediate: 'overload',
}

/** 上級で使うFINAL DOPA TRIALのtierプール（Q16専用のULTIMATE_QUESTION_POOLは含めない）。 */
export const FINAL_POOL_TIERS: FinalPoolTier[] = ['reversal', 'twoCondition', 'memory', 'mixed']

export const ENDLESS_DIFFICULTY_LABEL: Record<EndlessDifficulty, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
}

export const ENDLESS_DIFFICULTIES: EndlessDifficulty[] = ['beginner', 'intermediate', 'advanced']

/** 初級・中級が使う、通常ゲームの既存DifficultyPhaseをそのまま返す（上級はFINAL DOPA TRIAL側のため対象外）。 */
export function getEndlessPhase(difficulty: 'beginner' | 'intermediate'): DifficultyPhase {
  const phaseId = ENDLESS_DIFFICULTY_PHASE_ID[difficulty]
  const phase = DIFFICULTY_PHASES.find((p) => p.id === phaseId)
  if (!phase) throw new Error(`Endless: no DifficultyPhase found for id "${phaseId}"`)
  return phase
}

/** 初級・中級のBGM（utils/bgm.ts）が使うstageIndex（DIFFICULTY_PHASES内の添字）。上級はFINAL専用BGMモードを使うため対象外。 */
export function getEndlessBgmStageIndex(difficulty: 'beginner' | 'intermediate'): number {
  const phaseId = ENDLESS_DIFFICULTY_PHASE_ID[difficulty]
  const index = DIFFICULTY_PHASES.findIndex((p) => p.id === phaseId)
  return index < 0 ? 0 : index
}

/**
 * 連続正解数の節目。10/20/30/50で短い演出（バナー＋SE）を出し、以後は+50ごと
 * （100, 150, ...）に同じ演出を繰り返す。500%チャレンジのcheckpointのような長い
 * 停止演出ではなく、テンポを止めない一瞬のバナー表示にする（screens/EndlessPlayScreen.tsx参照）。
 */
const EARLY_MILESTONES = [10, 20, 30, 50] as const

export function isEndlessMilestone(streak: number): boolean {
  if ((EARLY_MILESTONES as readonly number[]).includes(streak)) return true
  return streak > 50 && streak % 50 === 0
}

/** 節目の演出強度（1〜5）。既存のsfx.comboMilestone(level)・sfx.endlessCorrect('advanced', level)にそのまま渡す。 */
export function endlessMilestoneLevel(streak: number): 1 | 2 | 3 | 4 | 5 {
  if (streak < 20) return 1
  if (streak < 30) return 2
  if (streak < 50) return 3
  if (streak < 100) return 4
  return 5
}
