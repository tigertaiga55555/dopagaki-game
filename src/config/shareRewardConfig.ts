/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: X結果シェア＋Heart報酬の定数。
 * ユーザー指示: シェア1回＝+1 Heart、1日2回まで。既存のリワード広告（1日3回、
 * config/adPolicyConfig.ts）とは完全に独立したカウンター——同じ日に両方を上限まで
 * 使い切れば、広告3回＋シェア2回＝合計5回分のボーナスHeartを得られる、という設計。
 *
 * 「1結果につき1回まで」（同じ結果を何度シェアしても2回目以降は付与しない）は、
 * この日次上限とは別のガード（share/shareRewardRepository.ts側でresultIdごとに管理）。
 */
export const SHARE_REWARD_DAILY_CAP = 2
export const SHARE_REWARD_HEART_GRANT = 1
