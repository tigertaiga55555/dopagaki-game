import { getCurrentPassPrice, getEffectiveReleaseAtMs, isLaunchCampaignActive } from '../config/dopaPassConfig'
import { deriveEntitlements, qaGrantDopaPass, qaLocalEntitlementRepository } from './entitlementRepository'
import { trackQaPassPurchaseSuccess } from '../utils/analytics'
import type { PassProduct, PaymentAdapter, PurchaseResult } from './paymentAdapter'
import type { EntitlementKey } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: PaymentAdapterのQA専用実装。実決済プロバイダを
 * 一切選定・統合しない（ユーザー指示）——常に即成功し、ローカルのentitlementRepository
 * だけを更新する。UI/呼び出し元はPaymentAdapter型だけに依存するため、将来実プロバイダの
 * 実装へこのファイルを丸ごと差し替えるだけで済む。
 *
 * startPurchase成功は正式なpurchase_success（analytics.ts）では絶対に送らず、
 * 別名のqa_purchase_successだけを送る（実購入ファネル指標の汚染を防ぐ、ユーザー指示）。
 */
export const qaPaymentAdapter: PaymentAdapter = {
  async getProducts(): Promise<PassProduct[]> {
    const now = Date.now()
    const releaseAt = getEffectiveReleaseAtMs()
    return [
      {
        id: 'dopa_pass',
        priceYen: getCurrentPassPrice(now, releaseAt),
        isLaunchCampaign: isLaunchCampaignActive(now, releaseAt),
      },
    ]
  },

  async startPurchase(productId: string): Promise<PurchaseResult> {
    if (productId !== 'dopa_pass') return { ok: false, reason: 'error' }
    const now = Date.now()
    const releaseAt = getEffectiveReleaseAtMs()
    const isCampaignPurchaser = isLaunchCampaignActive(now, releaseAt)
    qaGrantDopaPass(now, isCampaignPurchaser)
    trackQaPassPurchaseSuccess()
    return { ok: true }
  },

  async restorePurchases(): Promise<void> {
    // QA実装はサーバー側の購入記録を持たない（localStorageの状態がそのまま唯一の記録）ため、何もしない。
  },

  async getEntitlements(): Promise<EntitlementKey[]> {
    return deriveEntitlements(qaLocalEntitlementRepository.getPassState())
  },
}
