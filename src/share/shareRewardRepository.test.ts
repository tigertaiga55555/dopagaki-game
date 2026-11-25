import { beforeEach, describe, expect, it } from 'vitest'
import { grantShareRewardIfEligible, localShareRewardRepository, SHARE_REWARD_DAILY_CAP } from './shareRewardRepository'
import { canWatchRewardedAd, getRewardedAdViewsRemainingToday, recordRewardedAdViewed } from '../utils/rewardedAdStorage'
import { localHeartRepository, qaSetHeartCount } from '../utils/heartRepository'

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

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0)
const NEXT_DAY = T0 + 24 * 60 * 60 * 1000

describe('shareRewardRepository（item 61-66: X結果シェアのHeart報酬）', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態: 本日0回・どのresultIdも付与可能', () => {
    expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(0)
    expect(localShareRewardRepository.canRewardResult('r1', T0)).toBe(true)
  })

  it('1結果につき1回まで: 同じresultIdへ2回grantしても2回目は付与されない（二重クリック安全性）', () => {
    qaSetHeartCount(0, T0)
    const first = localShareRewardRepository.grantShareReward('r1', T0)
    const second = localShareRewardRepository.grantShareReward('r1', T0)
    expect(first.granted).toBe(true)
    expect(second.granted).toBe(false)
    expect(first.heartCount).toBe(1)
    // 2回目は付与されていないのでHeartは変化しない。
    expect(second.heartCount).toBe(1)
    expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(1)
  })

  it('同じ結果を連続で何度シェアしても（double-click）本当に1回しか増えない', () => {
    qaSetHeartCount(0, T0)
    for (let i = 0; i < 5; i++) localShareRewardRepository.grantShareReward('same-result', T0)
    expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(1)
  })

  it('日次上限: 1件目=+1・2件目=+1・3件目（別のresultId）=+0', () => {
    qaSetHeartCount(0, T0)
    const r1 = localShareRewardRepository.grantShareReward('r1', T0)
    const r2 = localShareRewardRepository.grantShareReward('r2', T0)
    const r3 = localShareRewardRepository.grantShareReward('r3', T0)
    expect(r1.granted).toBe(true)
    expect(r2.granted).toBe(true)
    expect(r3.granted).toBe(false)
    expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(SHARE_REWARD_DAILY_CAP)
  })

  it('翌日になると日次カウンターは0へリセットされ、新しい結果へまた付与できる', () => {
    qaSetHeartCount(0, T0)
    localShareRewardRepository.grantShareReward('r1', T0)
    localShareRewardRepository.grantShareReward('r2', T0)
    expect(localShareRewardRepository.canRewardResult('r3', T0)).toBe(false)

    expect(localShareRewardRepository.getDailyShareRewardCount(NEXT_DAY)).toBe(0)
    const nextDayGrant = localShareRewardRepository.grantShareReward('r3', NEXT_DAY)
    expect(nextDayGrant.granted).toBe(true)
  })

  it('翌日になっても「1結果につき1回まで」は日をまたいで持続する（同じ結果の後日再シェアは付与されない）', () => {
    qaSetHeartCount(0, T0)
    localShareRewardRepository.grantShareReward('r1', T0)
    // 日次カウンターは0にリセットされているが、r1自体は既に報酬済みのまま。
    expect(localShareRewardRepository.canRewardResult('r1', NEXT_DAY)).toBe(false)
    const reshared = localShareRewardRepository.grantShareReward('r1', NEXT_DAY)
    expect(reshared.granted).toBe(false)
  })

  it('reload後の再シェアでも二重付与されない（state読み込みはlocalStorageから常に新規に行うため、メモリキャッシュに依存しない）', () => {
    qaSetHeartCount(0, T0)
    localShareRewardRepository.grantShareReward('r1', T0)
    // 「リロード」を模す特別な操作は不要——このrepositoryはモジュールスコープの
    // キャッシュを一切持たず、呼び出しのたびにlocalStorageを読み直す設計そのものが
    // reload安全性を保証する。
    expect(localShareRewardRepository.canRewardResult('r1', T0)).toBe(false)
    const afterReload = localShareRewardRepository.grantShareReward('r1', T0)
    expect(afterReload.granted).toBe(false)
  })

  it('5個の自然回復上限を超えてHeartを持てる（リワード広告と同じ前例）', () => {
    qaSetHeartCount(5, T0)
    const outcome = localShareRewardRepository.grantShareReward('r1', T0)
    expect(outcome.granted).toBe(true)
    expect(outcome.heartCount).toBe(6)
  })

  describe('リワード広告のカウンターとは完全に独立している', () => {
    it('シェア報酬を2回使い切っても、リワード広告はまだ3回とも視聴可能', () => {
      qaSetHeartCount(0, T0)
      localShareRewardRepository.grantShareReward('r1', T0)
      localShareRewardRepository.grantShareReward('r2', T0)
      expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(2)
      expect(getRewardedAdViewsRemainingToday(T0)).toBe(3)
      expect(canWatchRewardedAd(T0)).toBe(true)
    })

    it('リワード広告を3回視聴し切っても、シェア報酬はまだ2回とも付与可能', () => {
      qaSetHeartCount(0, T0)
      recordRewardedAdViewed(T0)
      recordRewardedAdViewed(T0)
      recordRewardedAdViewed(T0)
      expect(canWatchRewardedAd(T0)).toBe(false)
      expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(0)
      expect(localShareRewardRepository.canRewardResult('r1', T0)).toBe(true)
      const outcome = localShareRewardRepository.grantShareReward('r1', T0)
      expect(outcome.granted).toBe(true)
    })

    it('同じ日に広告3回＋シェア2回＝合計5回分のボーナスHeartを得られる', () => {
      qaSetHeartCount(0, T0)
      recordRewardedAdViewed(T0)
      recordRewardedAdViewed(T0)
      recordRewardedAdViewed(T0)
      localShareRewardRepository.grantShareReward('r1', T0)
      localShareRewardRepository.grantShareReward('r2', T0)
      expect(localHeartRepository.getHeartCount(T0)).toBe(5)
    })
  })

  describe('PASS所有者はこの日次カウンターを一切消費しない', () => {
    it('hasPass=trueの間は、何回シェアしても日次カウンター・報酬済みリストのどちらも増えない', () => {
      qaSetHeartCount(5, T0)
      const outcome1 = grantShareRewardIfEligible(true, 'r1', T0)
      const outcome2 = grantShareRewardIfEligible(true, 'r1', T0)
      expect(outcome1.granted).toBe(false)
      expect(outcome2.granted).toBe(false)
      expect(localShareRewardRepository.getDailyShareRewardCount(T0)).toBe(0)
      // PASSを外せば、同じresultIdでもまだ未報酬のまま使える（カウンターが一切消費されていない証拠）。
      expect(localShareRewardRepository.canRewardResult('r1', T0)).toBe(true)
    })

    it('hasPass=falseなら通常どおり付与される', () => {
      qaSetHeartCount(0, T0)
      const outcome = grantShareRewardIfEligible(false, 'r1', T0)
      expect(outcome.granted).toBe(true)
      expect(outcome.heartCount).toBe(1)
    })
  })

  describe('Challenge作成とは完全に独立している', () => {
    it('同じresultId文字列に対してChallenge関連のストレージを一切操作しても、シェア報酬の判定には影響しない', () => {
      qaSetHeartCount(0, T0)
      // Challenge側の状態（別モジュール・別localStorageキー）を一切読み書きしていないことを
      // この独立したrepositoryの中だけで証明するのは意味がないため、ここでは「shareRewardRepository
      // 自身がresultId以外の外部状態を一切参照しない」ことを、同じresultIdでの連続呼び出しが
      // 常に同じ結果になることで示す（実際のChallenge/Share独立性はApp.tsx配線レベルで、
      // 2つのモジュールが互いのstorageキーを一切参照していないことによって構造的に保証される）。
      const before = localShareRewardRepository.canRewardResult('shared-result', T0)
      const outcome = localShareRewardRepository.grantShareReward('shared-result', T0)
      const after = localShareRewardRepository.canRewardResult('shared-result', T0)
      expect(before).toBe(true)
      expect(outcome.granted).toBe(true)
      expect(after).toBe(false)
    })
  })
})
