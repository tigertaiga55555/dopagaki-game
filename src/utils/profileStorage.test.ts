import { beforeEach, describe, expect, it } from 'vitest'
import { checkDopaPercentAchievements } from './achievementStorage'
import {
  equipTitle,
  equipTitleToSlot,
  findSlotForTitle,
  getOrCreatePlayerId,
  getProfile,
  getTitleInSlot,
  unequipTitleFromSlot,
  updateIcon,
  updateNickname,
} from './profileStorage'

function installFakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  const fake: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  globalThis.localStorage = fake
  return fake
}

describe('profileStorage (Ver.6 Phase 5: 匿名player_id・ローカルプロフィール)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('player_id初回生成: 初回アクセス時に何らかの一意なIDを生成する', () => {
    const id = getOrCreatePlayerId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('player_id永続化: 2回目以降の呼び出しでも同じIDが返る（リロードを模す）', () => {
    const first = getOrCreatePlayerId()
    const second = getOrCreatePlayerId()
    expect(second).toBe(first)
  })

  it('Profile保存: getProfile()は初回アクセス時にデフォルトプロフィールを自動作成・保存する', () => {
    const profile = getProfile()
    expect(profile.playerId.length).toBeGreaterThan(0)
    expect(profile.nickname.length).toBeGreaterThan(0)
    expect(profile.equippedTitleId).toBeNull()
    // 2回目の呼び出しでも同じplayer_id・nicknameが返る（毎回作り直さない）
    const again = getProfile()
    expect(again.playerId).toBe(profile.playerId)
    expect(again.nickname).toBe(profile.nickname)
  })

  it('nickname更新: 前後の空白を除去し、最大文字数でclampして保存する', () => {
    const updated = updateNickname('  ドパガキ太郎すぎる名前は切られるはず  ')
    expect(updated.nickname.startsWith(' ')).toBe(false)
    expect(Array.from(updated.nickname).length).toBeLessThanOrEqual(14)
    expect(getProfile().nickname).toBe(updated.nickname)
  })

  it('nickname更新: 空文字を保存しようとするとデフォルトへ戻る（空ニックネームにはならない）', () => {
    const updated = updateNickname('   ')
    expect(updated.nickname.length).toBeGreaterThan(0)
  })

  it('preset icon更新: 選択したアイコンが保存される', () => {
    const updated = updateIcon('flame')
    expect(updated.avatar).toEqual({ kind: 'preset', iconId: 'flame' })
    expect(getProfile().avatar).toEqual({ kind: 'preset', iconId: 'flame' })
  })

  it('legacy iconId互換: 旧フラットiconIdが保存されていてもavatar.iconIdとして読める', () => {
    const playerId = getOrCreatePlayerId()
    localStorage.setItem(
      'dopagaki:profileV1',
      JSON.stringify({ playerId, nickname: '旧ユーザー', iconId: 'crown', equippedTitleId: null, createdAt: Date.now() }),
    )
    const profile = getProfile()
    expect(profile.avatar).toEqual({ kind: 'preset', iconId: 'crown' })
  })

  it('title装備: 解除済みのTitleは装備できる', () => {
    checkDopaPercentAchievements(100) // dopa100実績→同idのTitleを解除
    const result = equipTitle('dopa100')
    expect(result.ok).toBe(true)
    expect(result.profile.equippedTitleId).toBe('dopa100')
    expect(getProfile().equippedTitleId).toBe('dopa100')
  })

  it('未解除title装備拒否: 未解除のTitleは装備できず、プロフィールも変化しない', () => {
    const before = getProfile()
    const result = equipTitle('dopa500') // どの実績も解除していない状態
    expect(result.ok).toBe(false)
    expect(getProfile().equippedTitleId).toBe(before.equippedTitleId)
  })

  it('title装備: nullを渡すといつでも未装備に戻せる', () => {
    checkDopaPercentAchievements(100)
    equipTitle('dopa100')
    const result = equipTitle(null)
    expect(result.ok).toBe(true)
    expect(result.profile.equippedTitleId).toBeNull()
  })

  it('次フェーズ（DOPA PASS基盤ラウンド）: isPassTitleOwnedがtrueを返すTitleは、実績未解除でも装備できる', () => {
    const result = equipTitle('pass_launch_campaign', (id) => id === 'pass_launch_campaign')
    expect(result.ok).toBe(true)
    expect(result.profile.equippedTitleId).toBe('pass_launch_campaign')
  })

  it('次フェーズ（DOPA PASS基盤ラウンド）: isPassTitleOwnedがfalseなら未解除のPASS Titleも拒否される', () => {
    const result = equipTitle('pass_launch_campaign', () => false)
    expect(result.ok).toBe(false)
  })

  it('初期プロフィールのsubTitleIdsは[null, null]', () => {
    expect(getProfile().subTitleIds).toEqual([null, null])
  })

  describe('次フェーズ（ゲーム機能クローズラウンド、item 72-74）: 3枠（main/sub1/sub2）のTitle装備', () => {
    it('PASS所有者はsub1/sub2へ装備できる', () => {
      checkDopaPercentAchievements(100)
      const result = equipTitleToSlot('dopa100', 'sub1', true)
      expect(result.ok).toBe(true)
      expect(result.profile.subTitleIds[0]).toBe('dopa100')
      expect(getTitleInSlot(result.profile, 'sub1')).toBe('dopa100')
    })

    it('無料ユーザー（hasPass=false）はsub1/sub2へ装備できない（何も変化しない）', () => {
      checkDopaPercentAchievements(100)
      const before = getProfile()
      const result = equipTitleToSlot('dopa100', 'sub1', false)
      expect(result.ok).toBe(false)
      expect(getProfile().subTitleIds).toEqual(before.subTitleIds)
    })

    it('無料ユーザーでもmain枠へは装備できる', () => {
      checkDopaPercentAchievements(100)
      const result = equipTitleToSlot('dopa100', 'main', false)
      expect(result.ok).toBe(true)
      expect(result.profile.equippedTitleId).toBe('dopa100')
    })

    it('未解除のTitleはどの枠にも装備できない', () => {
      const result = equipTitleToSlot('dopa500', 'sub1', true)
      expect(result.ok).toBe(false)
    })

    it('同じTitleを複数枠に重複させない: sub1にあるTitleをmainへ装備すると、sub1は自動的に空になる', () => {
      checkDopaPercentAchievements(100)
      equipTitleToSlot('dopa100', 'sub1', true)
      const result = equipTitleToSlot('dopa100', 'main', true)
      expect(result.profile.equippedTitleId).toBe('dopa100')
      expect(result.profile.subTitleIds[0]).toBeNull()
    })

    it('findSlotForTitle: 現在どの枠に入っているかを正しく返す（どこにも無ければnull）', () => {
      checkDopaPercentAchievements(100)
      const result = equipTitleToSlot('dopa100', 'sub2', true)
      expect(findSlotForTitle(result.profile, 'dopa100')).toBe('sub2')
      expect(findSlotForTitle(result.profile, 'dopa500')).toBeNull()
    })

    it('unequipTitleFromSlot: 指定した枠だけを未装備に戻す（他の枠には影響しない）', () => {
      checkDopaPercentAchievements(100)
      checkDopaPercentAchievements(120)
      equipTitleToSlot('dopa100', 'main', true)
      equipTitleToSlot('dopa120', 'sub1', true)
      const after = unequipTitleFromSlot('sub1')
      expect(after.subTitleIds[0]).toBeNull()
      expect(after.equippedTitleId).toBe('dopa100')
    })

    it('equipTitle（従来の単独main装備）もsub枠との重複を解消する', () => {
      checkDopaPercentAchievements(100)
      equipTitleToSlot('dopa100', 'sub1', true)
      const result = equipTitle('dopa100')
      expect(result.profile.equippedTitleId).toBe('dopa100')
      expect(result.profile.subTitleIds[0]).toBeNull()
    })
  })
})
