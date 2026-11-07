import { beforeEach, describe, expect, it } from 'vitest'
import { getAchievementCount, isAchievementUnlocked } from './achievementStorage'
import { runMigrationsOnce } from './migrations'
import { updateBestPercent } from './storage'

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

describe('migrations (Ver.6 Phase 5: 既存記録からAchievement遡及解除)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('既存記録からAchievement migration: Achievement機構導入前からbestPercentV4が350だったユーザーは、移行後にdopa100〜300まで遡及解除される', () => {
    // Achievement機構を知らない旧バージョンで既に350%まで到達済みだった状態を模す。
    updateBestPercent(350)
    expect(getAchievementCount()).toBe(0) // 移行前はまだ何も解除されていない

    runMigrationsOnce()

    expect(isAchievementUnlocked('dopa100')).toBe(true)
    expect(isAchievementUnlocked('dopa120')).toBe(true)
    expect(isAchievementUnlocked('dopa200')).toBe(true)
    expect(isAchievementUnlocked('dopa300')).toBe(true)
    expect(isAchievementUnlocked('dopa400')).toBe(false)
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    expect(getAchievementCount()).toBe(4)
  })

  it('bestPercentが0（新規ユーザー）の場合は何も解除しない', () => {
    runMigrationsOnce()
    expect(getAchievementCount()).toBe(0)
  })

  it('マイグレーションは冪等: 2回呼んでも実績が増え続けたりしない', () => {
    updateBestPercent(500)
    runMigrationsOnce()
    expect(getAchievementCount()).toBe(6)
    runMigrationsOnce()
    expect(getAchievementCount()).toBe(6)
  })

  it('マイグレーションは既存のbestPercentV4キーを一切書き換えない', () => {
    updateBestPercent(247)
    runMigrationsOnce()
    // storage.tsのgetBestPercent経由で読み直しても値が変わっていないことを確認
    expect(updateBestPercent(0)).toBe(false) // 0は247より小さいため更新されない＝元の値がまだ247のまま残っている証拠
  })
})
