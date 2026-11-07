import type { TitleDef } from '../types'

/**
 * Ver.6 Phase 5: Title（称号）の定義。今回はAchievement解除に対応して1対1で解放する
 * （unlockedByAchievementId）。TitleDef自体はidがAchievementIdに依存しない別の型
 * （types.ts参照）なので、将来「Rankingで上位に入ると解放されるTitle」等を
 * 追加するときもこの配列にエントリを足すだけで済む。
 *
 * nameは安全な仮称のまま（最終ネーミングは今回作り込まない）。
 */
export const TITLE_DEFS: TitleDef[] = [
  { id: 'dopa100', name: 'DOPA 100%', description: 'DOPA度100%に到達した証', unlockedByAchievementId: 'dopa100' },
  { id: 'dopa120', name: 'DOPA 120%', description: 'DOPA度120%に到達した証', unlockedByAchievementId: 'dopa120' },
  { id: 'dopa200', name: 'DOPA 200%', description: 'DOPA度200%に到達した証', unlockedByAchievementId: 'dopa200' },
  { id: 'dopa300', name: 'DOPA 300%', description: 'DOPA度300%に到達した証', unlockedByAchievementId: 'dopa300' },
  { id: 'dopa400', name: 'DOPA 400%', description: 'DOPA度400%に到達した証', unlockedByAchievementId: 'dopa400' },
  { id: 'dopa500', name: 'DOPA 500%', description: 'DOPA度500%に到達した証', unlockedByAchievementId: 'dopa500' },
]

export const TITLE_DEFS_BY_ID: Record<string, TitleDef> = Object.fromEntries(TITLE_DEFS.map((def) => [def.id, def]))
