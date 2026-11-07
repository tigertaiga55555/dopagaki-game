import type { AchievementDef, AchievementId } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: DOPA%系実績の定義。
 *
 * ユーザー指示どおり、まず以下6個のみ実装する（120%は必須）。id/name/description/
 * unlockConditionを分離してあるため、後から名称だけを差し替えても解除済みフラグ
 * （utils/achievementStorage.tsがidで管理）には一切影響しない。name/descriptionは
 * 「達成条件が分かる」安全な仮称のままにしてある（最終的なネーミングは今回作り込まない）。
 *
 * 配列の順序はDOPA%の昇順で固定し、Achievement画面はこの順序のままリスト表示する。
 */
export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'dopa100', name: 'DOPA 100%', description: 'DOPA度100%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 100 } },
  { id: 'dopa120', name: 'DOPA 120%', description: 'DOPA度120%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 120 } },
  { id: 'dopa200', name: 'DOPA 200%', description: 'DOPA度200%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 200 } },
  { id: 'dopa300', name: 'DOPA 300%', description: 'DOPA度300%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 300 } },
  { id: 'dopa400', name: 'DOPA 400%', description: 'DOPA度400%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 400 } },
  { id: 'dopa500', name: 'DOPA 500%', description: 'DOPA度500%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 500 } },
]

export const ACHIEVEMENT_DEFS_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((def) => [def.id, def]),
) as Record<AchievementId, AchievementDef>
