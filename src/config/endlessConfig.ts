import { DIFFICULTY_PHASES, type DifficultyPhase } from './difficultyConfig'
import type { EndlessDifficulty } from '../types'

/**
 * Ver.6 Phase 4: Endlessモードの難易度（初級/中級/上級）定義。
 *
 * 重要（ユーザー指示）: Endless専用の新しい問題難易度システムは作らない。通常ゲームが
 * 既に使っているconfig/difficultyConfig.tsのDIFFICULTY_PHASES（6フェーズ：warmup→ramp→
 * fake→boost→overload→finalRush、経過時間に応じて問題プール・出題速度が上がっていく）を
 * そのまま再利用し、各難易度を「その6フェーズのうちどれを固定で使うか」として定義するだけ。
 *
 * 通常ゲームは60秒の中でフェーズが自動的に進行するが、Endlessには「経過時間」という概念が
 * ない（1問MISSで即終了する無限モードのため）。そのため、選んだ難易度に対応するフェーズを
 * プレイ開始から終了まで固定で使い続ける（フェーズが時間で勝手に進行することはない）。
 *
 * 3段階の選び方: 6フェーズの中から、序盤（warmup）・中盤（boost）・終盤（finalRush）を
 * 均等に近い間隔で選び、初級〜上級のどこでプレイしても「別の問題プール・別の出題速度」に
 * なるようにした（questionPicker.generateNextQuestion()がphase.pool/phase.speedMultiplier/
 * phase.weightedTypesをそのまま使うため、問題ロジックの二重管理は発生しない）。
 */
export const ENDLESS_DIFFICULTY_PHASE_ID: Record<EndlessDifficulty, DifficultyPhase['id']> = {
  beginner: 'warmup',
  intermediate: 'boost',
  advanced: 'finalRush',
}

export const ENDLESS_DIFFICULTY_LABEL: Record<EndlessDifficulty, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
}

export const ENDLESS_DIFFICULTIES: EndlessDifficulty[] = ['beginner', 'intermediate', 'advanced']

/** 選んだ難易度に対応する、通常ゲームの既存DifficultyPhaseをそのまま返す。 */
export function getEndlessPhase(difficulty: EndlessDifficulty): DifficultyPhase {
  const phaseId = ENDLESS_DIFFICULTY_PHASE_ID[difficulty]
  const phase = DIFFICULTY_PHASES.find((p) => p.id === phaseId)
  if (!phase) throw new Error(`Endless: no DifficultyPhase found for id "${phaseId}"`)
  return phase
}

/** 通常ゲームのBGM（utils/bgm.ts）が使うstageIndex（DIFFICULTY_PHASES内の添字）。 */
export function getEndlessBgmStageIndex(difficulty: EndlessDifficulty): number {
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

/** 節目の演出強度（1〜5、既存のsfx.comboMilestone(level)にそのまま渡す）。 */
export function endlessMilestoneLevel(streak: number): 1 | 2 | 3 | 4 | 5 {
  if (streak < 20) return 1
  if (streak < 30) return 2
  if (streak < 50) return 3
  if (streak < 100) return 4
  return 5
}
