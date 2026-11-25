import { ELIGIBLE_PLAYS_PER_INTERSTITIAL, INTERSTITIAL_COOLDOWN_MS } from '../config/adPolicyConfig'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 強制インタースティシャルの発火判定。純粋関数
 * （DOM/localStorageに一切依存しない、battle/battleRoomEngine.tsと同じ方針）。
 *
 * 「しきい値に達したがクールダウン未経過」の場合、カウンターをリセットしない
 * （ユーザー指示）——クールダウンが明けた次のアクションでそのまま発火し、改めて3回分
 * 遊び直す必要はない。実際に表示した瞬間だけカウンターを0へ戻す（markInterstitialShown）。
 */
export interface AdPolicyState {
  eligiblePlayCount: number
  lastInterstitialShownAt: number | null
}

export function createAdPolicyState(): AdPolicyState {
  return { eligiblePlayCount: 0, lastInterstitialShownAt: null }
}

/** DOPA RUSH/ENDLESS/World Battleの合算カウンター。Challenge・ENDLESS Challenge・PRIVATE ROOMでは呼ばない。 */
export function recordEligiblePlay(state: AdPolicyState): AdPolicyState {
  return { ...state, eligiblePlayCount: state.eligiblePlayCount + 1 }
}

export function shouldShowInterstitial(state: AdPolicyState, nowMs: number): boolean {
  if (state.eligiblePlayCount < ELIGIBLE_PLAYS_PER_INTERSTITIAL) return false
  if (state.lastInterstitialShownAt === null) return true
  return nowMs - state.lastInterstitialShownAt >= INTERSTITIAL_COOLDOWN_MS
}

/** 実際に表示した瞬間だけ呼ぶ。カウンターを0へ戻し、クールダウンの基準時刻を更新する。 */
export function markInterstitialShown(_state: AdPolicyState, nowMs: number): AdPolicyState {
  return { eligiblePlayCount: 0, lastInterstitialShownAt: nowMs }
}
