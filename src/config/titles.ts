import type { TitleDef } from '../types'

/**
 * Ver.6 Phase 5.1（Achievement拡充）: Title（称号）の定義。計24個、各Achievementと1対1。
 *
 * TitleDef自体はidがAchievementIdに依存しない別の型（types.ts参照）なので、将来
 * 「Rankingで上位に入ると解放されるTitle」等をAchievement非依存で追加するときも
 * この配列にエントリを足すだけで済む。AchievementUIにTitleロジックを埋め込まず、
 * この分離構造のまま将来のChallenge/Ranking/Battle画面でも使い回す想定。
 *
 * nameは安全な仮称のまま（最終ネーミングは今回作り込まない）。既存6個（dopa100/120/
 * 200/300/400/500）のid/nameは一切変更していない。
 */
export const TITLE_DEFS: TitleDef[] = [
  { id: 'dopa50', name: 'DOPA 50%', description: 'DOPA度50%に到達した証', unlockedByAchievementId: 'dopa50' },
  { id: 'dopa100', name: 'DOPA 100%', description: 'DOPA度100%に到達した証', unlockedByAchievementId: 'dopa100' },
  { id: 'dopa120', name: 'DOPA 120%', description: 'DOPA度120%に到達した証', unlockedByAchievementId: 'dopa120' },
  { id: 'dopa150', name: 'DOPA 150%', description: 'DOPA度150%に到達した証', unlockedByAchievementId: 'dopa150' },
  { id: 'dopa200', name: 'DOPA 200%', description: 'DOPA度200%に到達した証', unlockedByAchievementId: 'dopa200' },
  { id: 'dopa250', name: 'DOPA 250%', description: 'DOPA度250%に到達した証', unlockedByAchievementId: 'dopa250' },
  { id: 'dopa300', name: 'DOPA 300%', description: 'DOPA度300%に到達した証', unlockedByAchievementId: 'dopa300' },
  { id: 'dopa350', name: 'DOPA 350%', description: 'DOPA度350%に到達した証', unlockedByAchievementId: 'dopa350' },
  { id: 'dopa400', name: 'DOPA 400%', description: 'DOPA度400%に到達した証', unlockedByAchievementId: 'dopa400' },
  { id: 'dopa450', name: 'DOPA 450%', description: 'DOPA度450%に到達した証', unlockedByAchievementId: 'dopa450' },
  { id: 'dopa490', name: 'FINAL QUESTION', description: '500%チャレンジのFINAL QUESTION（490%）に到達した証', unlockedByAchievementId: 'dopa490' },
  { id: 'dopa500', name: 'DOPA 500%', description: 'DOPA度500%に到達した証', unlockedByAchievementId: 'dopa500' },

  { id: 'endlessBeginner10', name: 'Endless初級 10連', description: 'Endless初級で10連続正解した証', unlockedByAchievementId: 'endlessBeginner10' },
  { id: 'endlessBeginner25', name: 'Endless初級 25連', description: 'Endless初級で25連続正解した証', unlockedByAchievementId: 'endlessBeginner25' },
  { id: 'endlessBeginner50', name: 'Endless初級 50連', description: 'Endless初級で50連続正解した証', unlockedByAchievementId: 'endlessBeginner50' },
  { id: 'endlessBeginner100', name: 'Endless初級 100連', description: 'Endless初級で100連続正解した証', unlockedByAchievementId: 'endlessBeginner100' },

  { id: 'endlessIntermediate5', name: 'Endless中級 5連', description: 'Endless中級で5連続正解した証', unlockedByAchievementId: 'endlessIntermediate5' },
  { id: 'endlessIntermediate15', name: 'Endless中級 15連', description: 'Endless中級で15連続正解した証', unlockedByAchievementId: 'endlessIntermediate15' },
  { id: 'endlessIntermediate30', name: 'Endless中級 30連', description: 'Endless中級で30連続正解した証', unlockedByAchievementId: 'endlessIntermediate30' },
  { id: 'endlessIntermediate50', name: 'Endless中級 50連', description: 'Endless中級で50連続正解した証', unlockedByAchievementId: 'endlessIntermediate50' },

  { id: 'endlessAdvanced3', name: 'Endless上級 3連', description: 'Endless上級で3連続正解した証', unlockedByAchievementId: 'endlessAdvanced3' },
  { id: 'endlessAdvanced10', name: 'Endless上級 10連', description: 'Endless上級で10連続正解した証', unlockedByAchievementId: 'endlessAdvanced10' },
  { id: 'endlessAdvanced20', name: 'Endless上級 20連', description: 'Endless上級で20連続正解した証', unlockedByAchievementId: 'endlessAdvanced20' },
  { id: 'endlessAdvanced30', name: 'Endless上級 30連', description: 'Endless上級で30連続正解した証', unlockedByAchievementId: 'endlessAdvanced30' },
]

export const TITLE_DEFS_BY_ID: Record<string, TitleDef> = Object.fromEntries(TITLE_DEFS.map((def) => [def.id, def]))
