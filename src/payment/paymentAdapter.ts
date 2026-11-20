import type { EntitlementKey } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: UI・ゲームコアが実際の決済プロバイダ（Web決済、
 * 将来のApple IAP等）から隔離される唯一の境界。今回はどの実プロバイダも選定・統合しない
 * （ユーザー指示）——このインターフェースと、payment/qaPaymentAdapter.ts（QA専用実装、
 * Preview検証用）だけを用意する。将来実プロバイダを実装する際は、この同じ型を満たす
 * 新しいPaymentAdapterを1つ追加するだけで差し替えられる（UI・ゲームコア側は
 * PaymentAdapter型にしか依存しないため、具体的な実装クラスのimportを持たない）。
 */
export interface PassProduct {
  id: 'dopa_pass'
  priceYen: number
  isLaunchCampaign: boolean
}

export type PurchaseResult = { ok: true } | { ok: false; reason: 'cancelled' | 'error' }

export interface PaymentAdapter {
  getProducts(): Promise<PassProduct[]>
  startPurchase(productId: string): Promise<PurchaseResult>
  restorePurchases(): Promise<void>
  getEntitlements(): Promise<EntitlementKey[]>
}
