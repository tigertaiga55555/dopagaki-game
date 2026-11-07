import type { AchievementDef, AchievementId } from '../types'

/**
 * Ver.6 Phase 5.1（Achievement大幅拡充）: 実績定義。計24個。
 *
 * DOPA%系12個（config内のDOPA_ACHIEVEMENTS）＋Endless系12個（初級/中級/上級×4段階、
 * ENDLESS_ACHIEVEMENTS）。既存6個（dopa100/120/200/300/400/500）のidはVer.6 Phase 5時点
 * から一切変更していない——Phase 5時点で既に解除していたユーザーの実績を壊さないため。
 *
 * id/name/description/unlockConditionを分離してあるため、後から名称だけを差し替えても
 * 解除済みフラグ（utils/achievementStorage.tsがidで管理）には一切影響しない。name/
 * descriptionは「達成条件が分かる」安全な仮称のままにしてある（最終的なネーミングは
 * 今回作り込まない）。
 *
 * 配列の順序はDOPA→Endless初級→中級→上級、各グループ内は閾値の昇順で固定し、
 * Achievement画面はこの順序のままリスト表示する。
 */
const DOPA_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'dopa50', name: 'DOPA 50%', description: 'DOPA度50%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 50 }, category: 'dopa' },
  { id: 'dopa100', name: 'DOPA 100%', description: 'DOPA度100%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 100 }, category: 'dopa' },
  { id: 'dopa120', name: 'DOPA 120%', description: 'DOPA度120%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 120 }, category: 'dopa' },
  { id: 'dopa150', name: 'DOPA 150%', description: 'DOPA度150%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 150 }, category: 'dopa' },
  { id: 'dopa200', name: 'DOPA 200%', description: 'DOPA度200%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 200 }, category: 'dopa' },
  { id: 'dopa250', name: 'DOPA 250%', description: 'DOPA度250%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 250 }, category: 'dopa' },
  { id: 'dopa300', name: 'DOPA 300%', description: 'DOPA度300%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 300 }, category: 'dopa' },
  { id: 'dopa350', name: 'DOPA 350%', description: 'DOPA度350%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 350 }, category: 'dopa' },
  { id: 'dopa400', name: 'DOPA 400%', description: 'DOPA度400%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 400 }, category: 'dopa' },
  { id: 'dopa450', name: 'DOPA 450%', description: 'DOPA度450%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 450 }, category: 'dopa' },
  // 490はMISSで400へ・正解で500へ即座に遷移し、bestPercentとして490そのものが記録されることが
  // ないため、専用のchallenge500FinalQuestion条件（engine/challenge500Engine.tsのreached490）で判定する。
  {
    id: 'dopa490',
    name: 'FINAL QUESTION到達',
    description: '500%チャレンジで490%（FINAL QUESTION）に到達する',
    unlockCondition: { type: 'challenge500FinalQuestion' },
    category: 'dopa',
  },
  { id: 'dopa500', name: 'DOPA 500%', description: 'DOPA度500%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 500 }, category: 'dopa' },
]

const ENDLESS_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'endlessBeginner10',
    name: 'Endless初級 10 STREAK',
    description: 'Endless初級で10連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 10 },
    category: 'endless',
    endlessDifficulty: 'beginner',
  },
  {
    id: 'endlessBeginner25',
    name: 'Endless初級 25 STREAK',
    description: 'Endless初級で25連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 25 },
    category: 'endless',
    endlessDifficulty: 'beginner',
  },
  {
    id: 'endlessBeginner50',
    name: 'Endless初級 50 STREAK',
    description: 'Endless初級で50連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 50 },
    category: 'endless',
    endlessDifficulty: 'beginner',
  },
  {
    id: 'endlessBeginner100',
    name: 'Endless初級 100 STREAK',
    description: 'Endless初級で100連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 100 },
    category: 'endless',
    endlessDifficulty: 'beginner',
  },
  {
    id: 'endlessIntermediate5',
    name: 'Endless中級 5 STREAK',
    description: 'Endless中級で5連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 5 },
    category: 'endless',
    endlessDifficulty: 'intermediate',
  },
  {
    id: 'endlessIntermediate15',
    name: 'Endless中級 15 STREAK',
    description: 'Endless中級で15連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 15 },
    category: 'endless',
    endlessDifficulty: 'intermediate',
  },
  {
    id: 'endlessIntermediate30',
    name: 'Endless中級 30 STREAK',
    description: 'Endless中級で30連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 30 },
    category: 'endless',
    endlessDifficulty: 'intermediate',
  },
  {
    id: 'endlessIntermediate50',
    name: 'Endless中級 50 STREAK',
    description: 'Endless中級で50連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 50 },
    category: 'endless',
    endlessDifficulty: 'intermediate',
  },
  {
    id: 'endlessAdvanced3',
    name: 'Endless上級 3 STREAK',
    description: 'Endless上級で3連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 3 },
    category: 'endless',
    endlessDifficulty: 'advanced',
  },
  {
    id: 'endlessAdvanced10',
    name: 'Endless上級 10 STREAK',
    description: 'Endless上級で10連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 10 },
    category: 'endless',
    endlessDifficulty: 'advanced',
  },
  {
    id: 'endlessAdvanced20',
    name: 'Endless上級 20 STREAK',
    description: 'Endless上級で20連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 20 },
    category: 'endless',
    endlessDifficulty: 'advanced',
  },
  {
    id: 'endlessAdvanced30',
    name: 'Endless上級 30 STREAK',
    description: 'Endless上級で30連続正解する',
    unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 30 },
    category: 'endless',
    endlessDifficulty: 'advanced',
  },
]

export const ACHIEVEMENT_DEFS: AchievementDef[] = [...DOPA_ACHIEVEMENTS, ...ENDLESS_ACHIEVEMENTS]

export const ACHIEVEMENT_DEFS_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((def) => [def.id, def]),
) as Record<AchievementId, AchievementDef>
