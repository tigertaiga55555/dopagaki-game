import { describe, expect, it } from 'vitest'
import { createAdPolicyState, markInterstitialShown, recordEligiblePlay, shouldShowInterstitial } from './adPolicyEngine'

describe('adPolicyEngine (DOPA PASS基盤ラウンド)', () => {
  it('しきい値未満ではshouldShowInterstitial=false', () => {
    let state = createAdPolicyState()
    state = recordEligiblePlay(state)
    state = recordEligiblePlay(state)
    expect(shouldShowInterstitial(state, 1000)).toBe(false)
  })

  it('初回しきい値到達（lastShown無し）は即true', () => {
    let state = createAdPolicyState()
    for (let i = 0; i < 3; i++) state = recordEligiblePlay(state)
    expect(shouldShowInterstitial(state, 1000)).toBe(true)
  })

  it('しきい値到達済みでもクールダウン未経過ならfalse、かつカウンターはリセットされない（defer, don\'t reset）', () => {
    let state = createAdPolicyState()
    for (let i = 0; i < 3; i++) state = recordEligiblePlay(state)
    state = markInterstitialShown(state, 0)
    for (let i = 0; i < 3; i++) state = recordEligiblePlay(state)
    expect(shouldShowInterstitial(state, 1000)).toBe(false)
    expect(state.eligiblePlayCount).toBe(3)
  })

  it('クールダウンが明けた次のアクションで、追加の3プレイ無しに即発火する', () => {
    let state = createAdPolicyState()
    for (let i = 0; i < 3; i++) state = recordEligiblePlay(state)
    state = markInterstitialShown(state, 0)
    for (let i = 0; i < 3; i++) state = recordEligiblePlay(state)
    expect(shouldShowInterstitial(state, 5 * 60 * 1000)).toBe(true)
  })
})
