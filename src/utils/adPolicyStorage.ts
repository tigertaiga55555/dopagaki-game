import { createAdPolicyState, markInterstitialShown, recordEligiblePlay, shouldShowInterstitial, type AdPolicyState } from './adPolicyEngine'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: adPolicyEngine.ts（純粋関数）のlocalStorageラッパー。
 * utils/heartRepository.tsと同じ方針。
 */
const AD_POLICY_STATE_KEY = 'dopagaki:adPolicyStateV1'

function readState(): AdPolicyState {
  try {
    const raw = localStorage.getItem(AD_POLICY_STATE_KEY)
    if (!raw) return createAdPolicyState()
    const parsed = JSON.parse(raw) as Partial<AdPolicyState>
    if (typeof parsed.eligiblePlayCount !== 'number') return createAdPolicyState()
    return { eligiblePlayCount: parsed.eligiblePlayCount, lastInterstitialShownAt: parsed.lastInterstitialShownAt ?? null }
  } catch {
    return createAdPolicyState()
  }
}

function writeState(state: AdPolicyState): void {
  try {
    localStorage.setItem(AD_POLICY_STATE_KEY, JSON.stringify(state))
  } catch {
    // 致命的ではない。
  }
}

/** DOPA RUSH/ENDLESS/World Battleの完了時だけ呼ぶ（Challenge・ENDLESS Challenge・PRIVATE ROOMでは呼ばない）。 */
export function recordEligiblePlayCompleted(): void {
  writeState(recordEligiblePlay(readState()))
}

/**
 * trueを返す場合、呼び出し側は必ずこの呼び出しと同じタイミングでインタースティシャルを
 * 表示する責任を持つ——true判定と同時にここでmarkInterstitialShownも適用済みにする
 * （二重発火を防ぐため、判定と消費を1つの操作として扱う）。
 */
export function checkAndConsumeInterstitial(now = Date.now()): boolean {
  const state = readState()
  if (!shouldShowInterstitial(state, now)) return false
  writeState(markInterstitialShown(state, now))
  return true
}
