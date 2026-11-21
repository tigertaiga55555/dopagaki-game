import type { EntitlementKey } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: utils/heartRepository.tsと同じ方針
 * （Repositoryインターフェース＋ローカル実装、localStorageラッパーはtry/catchで囲む）。
 *
 * 「hasDopaPass」という単一boolをUI各所に散らすのではなく、EntitlementKey（types.ts）
 * ごとに`hasEntitlement(key)`で確認する設計にする——deriveEntitlements()が
 * 「DOPA_PASS所有→5つ全部true」という現在の1:1写像を唯一の場所で表現しており、
 * 将来の商品構成変更（例: PRIVATE_ROOM_CREATEだけの単体販売追加）がこの1関数の修正だけで
 * 済み、呼び出し側（UI・ゲームコア）は一切変更不要になるようにするための抽象境界。
 *
 * 本番向けの注記（最終報告書にも誠実に記載する既知のギャップ）: ここでの「PASS所有」は
 * あくまでこの端末のlocalStorageに保存された値であり、今回のラウンドではまだ実際の
 * アカウント／決済システムが存在しないため、サーバー側で検証可能な形にはなっていない
 * （payment/qaPaymentAdapter.ts参照）。将来、実決済プロバイダ統合時にサーバー権威の
 * entitlement確認へ置き換える際も、呼び出し側は変わらずEntitlementRepository型にしか
 * 依存しないため、実装をこのファイル1つの差し替えで済ませられる。
 */
export interface PassState {
  owned: boolean
  grantedAt: number | null
  /** item: 発売キャンペーン期間中に購入したかどうか（初代ドパガキTitle付与の判定に使う）。 */
  isLaunchCampaignPurchaser: boolean
}

const PASS_STATE_KEY = 'dopagaki:dopaPassStateV1'

function readPassState(): PassState {
  try {
    const raw = localStorage.getItem(PASS_STATE_KEY)
    if (!raw) return { owned: false, grantedAt: null, isLaunchCampaignPurchaser: false }
    const parsed = JSON.parse(raw) as Partial<PassState>
    return {
      owned: parsed.owned === true,
      grantedAt: typeof parsed.grantedAt === 'number' ? parsed.grantedAt : null,
      isLaunchCampaignPurchaser: parsed.isLaunchCampaignPurchaser === true,
    }
  } catch {
    return { owned: false, grantedAt: null, isLaunchCampaignPurchaser: false }
  }
}

function writePassState(state: PassState): void {
  try {
    localStorage.setItem(PASS_STATE_KEY, JSON.stringify(state))
  } catch {
    // 書き込み失敗は致命的ではない（次回アクセス時に再試行されるだけ）。
  }
}

/**
 * DOPA_PASS所有が意味するentitlementの集合を決める、唯一の場所。現在は1:1写像
 * （所有→5つ全部true、非所有→5つ全部false）だが、将来の商品構成変更（例:
 * PRIVATE_ROOM_CREATEのみの単体販売）はこの関数だけを書き換えれば済む。
 */
export function deriveEntitlements(state: PassState): EntitlementKey[] {
  if (!state.owned) return []
  return ['DOPA_PASS', 'PRIVATE_ROOM_CREATE', 'UNLIMITED_HEART', 'AD_FREE', 'FULL_HISTORY']
}

export interface EntitlementRepository {
  hasEntitlement(key: EntitlementKey): boolean
  getPassState(): PassState
}

export const qaLocalEntitlementRepository: EntitlementRepository = {
  hasEntitlement(key: EntitlementKey): boolean {
    return deriveEntitlements(readPassState()).includes(key)
  },
  getPassState(): PassState {
    return readPassState()
  },
}

/** Preview/QA・QAPaymentAdapter専用。Production UIから直接呼ばない。 */
export function qaGrantDopaPass(nowMs: number, isLaunchCampaignPurchaser: boolean): void {
  writePassState({ owned: true, grantedAt: nowMs, isLaunchCampaignPurchaser })
}

/** Preview/QA専用（PASSをOFFへ戻す確認用）。 */
export function qaRevokeDopaPass(): void {
  writePassState({ owned: false, grantedAt: null, isLaunchCampaignPurchaser: false })
}
