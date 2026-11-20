/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 履歴の無料/PASS表示差分の設定値。
 *
 * 重要な設計判断: 無料ユーザーの「直近5件だけ表示」はUI/表示層の制限であり、ストレージ層
 * （D1の実レコード）は一切削除・切り詰めない——PASSを後から購入したユーザーは、購入直後に
 * 既存の全履歴が即座に見えるようにする（ユーザー指示）。HISTORY_ID_STORAGE_CAPは
 * 技術的な上限（端末のlocalStorageに保存するID配列の上限）であり、FREE_HISTORY_DISPLAY_LIMIT
 * （無料ユーザーの表示件数）とは別物——前者を表示制限に使い回すと、PASS購入後も
 * 古い履歴を復元できなくなる構造的な欠陥になるため、明確に分離する。
 */
export const FREE_HISTORY_DISPLAY_LIMIT = 5
export const HISTORY_ID_STORAGE_CAP = 500
