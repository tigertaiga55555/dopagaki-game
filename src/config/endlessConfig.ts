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
 *   参照）。FINAL DOPA TRIAL固有問題・Challenge500固有問題は出さない。**今回の
 *   難易度再設計（item 154-156）では初級は一切変更しない。**
 * - 中級 = FINAL DOPA TRIALの前半2tier（reversal/twoCondition、実質120〜160%未満相当）
 *   だけを使う。Challenge500固有の下線反転問題は含めない。
 * - 上級 = FINAL DOPA TRIALの後半2tier（memory/mixed、実質160〜200%未満相当）＋
 *   200〜500% LIMIT BREAK（Challenge500）の既存11問題タイプ＋下線部のみ意味を反転する
 *   0/1/2反転ルールを混在させる。reversal/twoConditionは上級からは完全に除外する
 *   （中級と丸かぶりしていた旧仕様の修正、item 154）。
 *
 * 次フェーズ（item 154-156、ENDLESS中級・上級の難易度再設計）: 旧仕様では中級・上級が
 * 共にFINAL_POOL_TIERS（reversal/twoCondition/memory/mixedの4tier全部）を使っており、
 * 「中級が上級の一部をそのまま内包してしまう」ことが中級・上級の差の小さい主因だった。
 * FINAL_TRIAL_CONFIG.tierForQuestionNumber()で算出した実際の％帯（reversal=120〜140%未満・
 * twoCondition=140〜160%未満・memory=160〜180%未満・mixed=180〜200%未満）を根拠に、
 * twoConditionの上限とmemoryの下限が160%でクリーンに一致する境界を使い、中級=前半2tier・
 * 上級=後半2tier＋Challenge500、という重複もギャップもない区切りへ再設計した
 * （100〜120%未満の明示的な代表問題は存在しないため、中級の実質下限は120%とし、
 * その旨を正直に報告する——初級の0〜120%合成プールを転用すると初級と丸かぶりするため
 * 転用しない判断とした）。各tier→実際の出題選択ロジックはengine/endlessIntermediatePicker.ts
 * （中級）・engine/endlessAdvancedPicker.ts（上級）を参照。
 * Challenge500側のDOPA%進行・チェックポイント・tier別MISSペナルティ・400%台1MISS終了
 * などの「進行ルール」はEndlessへ一切持ち込まない——Endlessは常に「1 MISS = END」のみ。
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

/** FINAL DOPA TRIALの実在4tier全体（Q16専用のULTIMATE_QUESTION_POOLは含めない）。Endless側は
 *  item 154以降、中級・上級それぞれ下の専用サブセットを使う——この定数自体は「4tierが
 *  存在する」という事実の参照用に残す（本家FinalTrialScreen.tsxのQ1〜Q15はこの4tier全部を
 *  順に使う。Endlessの中級/上級はこの配列を直接pickしない）。 */
export const FINAL_POOL_TIERS: FinalPoolTier[] = ['reversal', 'twoCondition', 'memory', 'mixed']

/**
 * 次フェーズ（item 154）: 中級専用プール。FINAL_TRIAL_CONFIG.tierForQuestionNumber()で
 * 実際に算出される％帯のうち、reversal=120〜140%未満・twoCondition=140〜160%未満の
 * 「前半2tier」だけを使う（実質120〜160%未満相当）。memory/mixedは上級専用へ移動した。
 */
export const ENDLESS_INTERMEDIATE_POOL_TIERS: FinalPoolTier[] = ['reversal', 'twoCondition']

/**
 * 次フェーズ（item 154）: 上級のFINAL系出題対象プール。memory=160〜180%未満・
 * mixed=180〜200%未満の「後半2tier」だけを使う（reversal/twoConditionは中級専用のため
 * 上級からは完全に除外——旧仕様の「中級が上級に丸ごと内包される」問題を解消する）。
 */
export const ENDLESS_ADVANCED_FINAL_POOL_TIERS: FinalPoolTier[] = ['memory', 'mixed']

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
