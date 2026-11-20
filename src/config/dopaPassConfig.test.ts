import { describe, expect, it } from 'vitest'
import {
  DOPA_PASS_LAUNCH_CAMPAIGN_PRICE_YEN,
  DOPA_PASS_STANDARD_PRICE_YEN,
  LAUNCH_CAMPAIGN_DURATION_MS,
  daysRemainingInLaunchCampaign,
  getCurrentPassPrice,
  isLaunchCampaignActive,
} from './dopaPassConfig'

const RELEASE_AT = 1_000_000_000_000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

describe('dopaPassConfig (DOPA PASS基盤ラウンド)', () => {
  it('リリース前はキャンペーン非アクティブ・標準価格', () => {
    expect(isLaunchCampaignActive(RELEASE_AT - 1, RELEASE_AT)).toBe(false)
    expect(getCurrentPassPrice(RELEASE_AT - 1, RELEASE_AT)).toBe(DOPA_PASS_STANDARD_PRICE_YEN)
  })

  it('リリース直後〜29日目まではキャンペーン価格', () => {
    expect(isLaunchCampaignActive(RELEASE_AT, RELEASE_AT)).toBe(true)
    expect(getCurrentPassPrice(RELEASE_AT + 10 * ONE_DAY_MS, RELEASE_AT)).toBe(DOPA_PASS_LAUNCH_CAMPAIGN_PRICE_YEN)
  })

  it('30日経過後は標準価格へ戻る', () => {
    const after = RELEASE_AT + LAUNCH_CAMPAIGN_DURATION_MS
    expect(isLaunchCampaignActive(after, RELEASE_AT)).toBe(false)
    expect(getCurrentPassPrice(after, RELEASE_AT)).toBe(DOPA_PASS_STANDARD_PRICE_YEN)
  })

  it('daysRemainingInLaunchCampaign: キャンペーン外は常に0', () => {
    expect(daysRemainingInLaunchCampaign(RELEASE_AT - 1, RELEASE_AT)).toBe(0)
  })

  it('daysRemainingInLaunchCampaign: 残り時間は秒単位ではなく日数（切り上げ、最小1）', () => {
    const almostDone = RELEASE_AT + LAUNCH_CAMPAIGN_DURATION_MS - 1000
    expect(daysRemainingInLaunchCampaign(almostDone, RELEASE_AT)).toBe(1)
  })
})
