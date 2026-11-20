import { qaLocalEntitlementRepository } from './entitlementRepository'
import { LAUNCH_CAMPAIGN_PASS_TITLE } from '../config/passTitles'
import type { TitleId } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 「初代ドパガキ」Titleの付与判定。
 * payment/entitlementRepository.tsのPassState.isLaunchCampaignPurchaserが唯一の根拠
 * ——発売キャンペーン期間中に購入した記録を一度でも持っていれば、以後PASS自体を
 * 手放すことがない仕様（ユーザー指示: PASSに「後で失う」概念は無い）のため、
 * 永久に所有し続ける（isLaunchCampaignPurchaserフラグ自体を後から取り消す経路を
 * どこにも作らない）。
 */
export function getOwnedPassTitleIds(): TitleId[] {
  const state = qaLocalEntitlementRepository.getPassState()
  if (state.owned && state.isLaunchCampaignPurchaser) return [LAUNCH_CAMPAIGN_PASS_TITLE.id]
  return []
}

export function isPassTitleOwned(titleId: TitleId): boolean {
  return getOwnedPassTitleIds().includes(titleId)
}
