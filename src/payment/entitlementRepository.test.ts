import { beforeEach, describe, expect, it } from 'vitest'
import { deriveEntitlements, qaGrantDopaPass, qaLocalEntitlementRepository, qaRevokeDopaPass } from './entitlementRepository'

function installFakeLocalStorage(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

describe('entitlementRepository (DOPA PASS基盤ラウンド)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('deriveEntitlements: 非所有は常に空配列', () => {
    expect(deriveEntitlements({ owned: false, grantedAt: null, isLaunchCampaignPurchaser: false })).toEqual([])
  })

  it('deriveEntitlements: 所有は5つ全部', () => {
    const keys = deriveEntitlements({ owned: true, grantedAt: 1000, isLaunchCampaignPurchaser: false })
    expect(keys).toEqual(['DOPA_PASS', 'PRIVATE_ROOM_CREATE', 'UNLIMITED_HEART', 'AD_FREE', 'FULL_HISTORY'])
  })

  it('qaGrantDopaPass後、hasEntitlementが全キーでtrueになる', () => {
    qaGrantDopaPass(1000, false)
    expect(qaLocalEntitlementRepository.hasEntitlement('DOPA_PASS')).toBe(true)
    expect(qaLocalEntitlementRepository.hasEntitlement('PRIVATE_ROOM_CREATE')).toBe(true)
    expect(qaLocalEntitlementRepository.hasEntitlement('UNLIMITED_HEART')).toBe(true)
  })

  it('qaRevokeDopaPass後、hasEntitlementが全キーでfalseに戻る', () => {
    qaGrantDopaPass(1000, false)
    qaRevokeDopaPass()
    expect(qaLocalEntitlementRepository.hasEntitlement('DOPA_PASS')).toBe(false)
  })

  it('isLaunchCampaignPurchaserがgetPassStateへ正しく保存・反映される', () => {
    qaGrantDopaPass(1000, true)
    expect(qaLocalEntitlementRepository.getPassState().isLaunchCampaignPurchaser).toBe(true)
  })
})
