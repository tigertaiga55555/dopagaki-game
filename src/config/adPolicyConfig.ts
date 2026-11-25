/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 広告ポリシー（インタースティシャル・リワード広告）の
 * 定数。ユーザー指示: DOPA RUSH＋ENDLESS＋World Battleの合算で3回に1回、強制インタース
 * ティシャルを挟む（Challenge・ENDLESS Challenge・PRIVATE ROOMは対象外＝カウントしない・
 * 発火もしない）。直前の表示から5分未満ならしきい値に達していても見送る（カウンターは
 * リセットしない——クールダウンが明けた次のアクションで即発火する）。リワード広告は
 * 無料ユーザーのみ、1回視聴で即+1 Heart、1日3回まで。
 *
 * 実際の広告ネットワーク接続は今回も行わない（ADS_ENABLED_V6=falseのまま変更しない、
 * 既存の前ラウンドの決定を維持する）。
 */
export const ELIGIBLE_PLAYS_PER_INTERSTITIAL = 3
export const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000
export const REWARDED_AD_DAILY_CAP = 3
export const REWARDED_AD_HEART_GRANT = 1
