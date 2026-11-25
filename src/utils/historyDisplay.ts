import { FREE_HISTORY_DISPLAY_LIMIT } from '../config/historyConfig'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 無料/PASSの履歴表示差分を担う、唯一の表示層
 * 純粋関数。ストレージ層（createdChallengesStorage.ts等・D1）は一切切り詰めない——
 * ここで渡された配列（既に新しい順でソート済みの前提）を、hasFullHistory=falseの間だけ
 * 直近FREE_HISTORY_DISPLAY_LIMIT件に制限する。PASS購入後（hasFullHistory=true）は
 * 即座に全件が見える（この関数を呼ぶ画面側が、以後そのまま全件を渡すだけで良い）。
 */
export interface HistoryDisplayResult<T> {
  visible: T[]
  /** 無料ユーザーで、実際に表示件数より多くの履歴が存在する場合だけtrue。 */
  truncated: boolean
}

export function applyHistoryDisplayLimit<T>(items: T[], hasFullHistory: boolean): HistoryDisplayResult<T> {
  if (hasFullHistory) return { visible: items, truncated: false }
  const truncated = items.length > FREE_HISTORY_DISPLAY_LIMIT
  return { visible: items.slice(0, FREE_HISTORY_DISPLAY_LIMIT), truncated }
}
