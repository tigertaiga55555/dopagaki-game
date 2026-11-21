import { DIFFICULTY_PHASES, type DifficultyPhase } from './difficultyConfig'
import type { EndlessDifficulty, FinalPoolTier } from '../types'

/**
 * Ver.6 Phase 4.2（難易度再々設計、実機QA後の最新仕様）: Endlessモードの難易度
 * （初級/中級/上級）定義。
 *
 * 77c21ef時点の旧マッピング（初級=ramp／中級=overload／上級=FINAL DOPA TRIAL）は
 * この実機QA後の指示により差し替える。最新仕様：
 *
 * - 初級 = 通常ゲーム0〜120%相当。特定の1フェーズだけでなく、0〜120%全体
 *   （warmup〜finalRushの6フェーズ）を代表する問題構成にする（下のbuildEndlessBeginnerPhase
 *   参照）。FINAL DOPA TRIAL固有問題・Challenge500固有問題は出さない。
 * - 中級 = FINAL DOPA TRIAL（120〜200%）の問題群をそのまま再利用（reversal/
 *   twoCondition/memory/mixedの4tier）。Challenge500固有の下線反転問題は含めない。
 * - 上級 = 120〜500%相当の「全部乗せ」。FINAL DOPA TRIAL問題群 ＋ 200〜500%
 *   LIMIT BREAK（Challenge500）の既存11問題タイプ＋下線部のみ意味を反転する0/1/2反転
 *   ルールを混在させる（実際の出題元選択ロジックはengine/endlessAdvancedPicker.ts）。
 *   Challenge500側のDOPA%進行・チェックポイント・tier別MISSペナルティ・400%台1MISS終了
 *   などの「進行ルール」はEndlessへ一切持ち込まない——Endlessは常に「1 MISS = END」のみ。
 *
 * いずれも新しい問題コンポーネント・新しい時間ルールは作らず、既存の問題生成ロジック
 * （generateNextQuestion／pickFinalQuestion／pickChallenge500Question）をそのまま
 * 呼び出すだけ。色分け（emerald/FLOW・cyan/FOCUS・red-orange/DANGER）・級ごとの
 * 音テーマ（sfx.endlessCorrect/endlessMiss）・Endless基本システム（STREAK・1 MISS = END・
 * 難易度別BEST等）は一切変更しない。
 */

/**
 * 初級専用: 0〜120%の6フェーズ（warmup/ramp/fake/boost/overload/finalRush）を代表する
 * 合成フェーズ。特定の1フェーズのプールをそのまま使うと「そのフェーズの速さ・偏り」に
 * 固定されてしまうため、
 * - pool: 全フェーズのプールの和集合（重複除去。fake⊂overload・warmup⊂rampのように、
 *   実際にはoverload.poolがほぼ全体を代表するが、将来フェーズ構成が変わっても追従できるよう
 *   プログラムで和集合を計算する）
 * - speedMultiplier: 全フェーズのspeedMultiplierの単純平均（特定フェーズの数値を
 *   流用するのではなく、既存の6個の値そのものから算出した代表値）
 * - visualLevel: 全フェーズのvisualLevelの平均を四捨五入
 * - weightedTypes: 持たない（特定の難しいタイプへ偏らせない。0〜120%全体の「平均的な
 *   出やすさ」をそのまま反映する）
 * で構成する。DifficultyPhase型のid/label/startSec/endSecは形式上必要なフィールドだが
 * generateNextQuestion()はこれらを一切参照しないため、実在のフェーズと混同されない
 * ラベルだけを持たせている。
 */
function buildEndlessBeginnerPhase(): DifficultyPhase {
  const pool = Array.from(new Set(DIFFICULTY_PHASES.flatMap((p) => p.pool)))
  const speedMultiplier = DIFFICULTY_PHASES.reduce((sum, p) => sum + p.speedMultiplier, 0) / DIFFICULTY_PHASES.length
  const visualLevel = Math.round(DIFFICULTY_PHASES.reduce((sum, p) => sum + p.visualLevel, 0) / DIFFICULTY_PHASES.length)
  return {
    // id/label/startSec/endSecはDifficultyPhase型を満たすための形式的な値（generateNextQuestionは未参照）。
    id: 'ramp',
    label: 'Endless初級（0〜120%代表）',
    startSec: 0,
    endSec: 60,
    speedMultiplier,
    pool,
    visualLevel,
  }
}

export const ENDLESS_BEGINNER_PHASE: DifficultyPhase = buildEndlessBeginnerPhase()

/** 初級のBGM（通常6段階エンジン）stageIndex。0〜5の単純平均を四捨五入した代表値（特定フェーズに紐付けない）。 */
export const ENDLESS_BEGINNER_BGM_STAGE_INDEX = Math.round(
  DIFFICULTY_PHASES.reduce((sum, _p, i) => sum + i, 0) / DIFFICULTY_PHASES.length,
)

/** 中級・上級で使うFINAL DOPA TRIALのtierプール（Q16専用のULTIMATE_QUESTION_POOLは含めない）。 */
export const FINAL_POOL_TIERS: FinalPoolTier[] = ['reversal', 'twoCondition', 'memory', 'mixed']

export const ENDLESS_DIFFICULTY_LABEL: Record<EndlessDifficulty, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
}

export const ENDLESS_DIFFICULTIES: EndlessDifficulty[] = ['beginner', 'intermediate', 'advanced']

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

/** 節目の演出強度（1〜5）。既存のsfx.comboMilestone(level)・sfx.endlessCorrect(difficulty, level)にそのまま渡す。 */
export function endlessMilestoneLevel(streak: number): 1 | 2 | 3 | 4 | 5 {
  if (streak < 20) return 1
  if (streak < 30) return 2
  if (streak < 50) return 3
  if (streak < 100) return 4
  return 5
}
