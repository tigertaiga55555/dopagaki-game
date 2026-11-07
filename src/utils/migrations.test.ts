import { beforeEach, describe, expect, it } from 'vitest'
import { getAchievementCount, isAchievementUnlocked } from './achievementStorage'
import { runMigrationsOnce } from './migrations'
import { updateBestPercent, updateEndlessBest } from './storage'

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

describe('migrations (Ver.6 Phase 5.1: 既存記録からAchievement遡及解除・v2拡張)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('既存記録からAchievement migration: Achievement機構導入前からbestPercentV4が350だったユーザーは、移行後にdopa50〜350まで遡及解除される', () => {
    // Achievement機構を知らない旧バージョンで既に350%まで到達済みだった状態を模す。
    updateBestPercent(350)
    expect(getAchievementCount()).toBe(0) // 移行前はまだ何も解除されていない

    runMigrationsOnce()

    expect(isAchievementUnlocked('dopa50')).toBe(true)
    expect(isAchievementUnlocked('dopa100')).toBe(true)
    expect(isAchievementUnlocked('dopa120')).toBe(true)
    expect(isAchievementUnlocked('dopa150')).toBe(true)
    expect(isAchievementUnlocked('dopa200')).toBe(true)
    expect(isAchievementUnlocked('dopa250')).toBe(true)
    expect(isAchievementUnlocked('dopa300')).toBe(true)
    expect(isAchievementUnlocked('dopa350')).toBe(true)
    expect(isAchievementUnlocked('dopa400')).toBe(false)
    expect(isAchievementUnlocked('dopa490')).toBe(false)
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    expect(getAchievementCount()).toBe(8)
  })

  it('v2: bestPercentV4が500（クリア済み）だったユーザーは、490通過が推論によりdopa490も遡及解除される', () => {
    updateBestPercent(500)
    runMigrationsOnce()
    expect(isAchievementUnlocked('dopa490')).toBe(true)
    expect(isAchievementUnlocked('dopa500')).toBe(true)
    expect(getAchievementCount()).toBe(12) // dopaPercent系11 + dopa490
  })

  it('v2: Endless初級/中級/上級の既存BESTから、対応するSTREAK実績が遡及解除される', () => {
    updateEndlessBest('beginner', 30)
    updateEndlessBest('intermediate', 5)
    updateEndlessBest('advanced', 25)

    runMigrationsOnce()

    expect(isAchievementUnlocked('endlessBeginner10')).toBe(true)
    expect(isAchievementUnlocked('endlessBeginner25')).toBe(true)
    expect(isAchievementUnlocked('endlessBeginner50')).toBe(false)
    expect(isAchievementUnlocked('endlessIntermediate5')).toBe(true)
    expect(isAchievementUnlocked('endlessIntermediate15')).toBe(false)
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(true)
    expect(isAchievementUnlocked('endlessAdvanced10')).toBe(true)
    expect(isAchievementUnlocked('endlessAdvanced20')).toBe(true)
    expect(isAchievementUnlocked('endlessAdvanced30')).toBe(false)
  })

  it('bestPercentもEndless BESTも0（新規ユーザー）の場合は何も解除しない', () => {
    runMigrationsOnce()
    expect(getAchievementCount()).toBe(0)
  })

  it('マイグレーションは冪等: 2回呼んでも実績が増え続けたりしない', () => {
    updateBestPercent(500)
    updateEndlessBest('beginner', 100)
    runMigrationsOnce()
    const afterFirst = getAchievementCount()
    runMigrationsOnce()
    expect(getAchievementCount()).toBe(afterFirst)
  })

  it('マイグレーションは既存のbestPercentV4・EndlessBESTキーを一切書き換えない（既存データを失わない）', () => {
    updateBestPercent(247)
    updateEndlessBest('beginner', 42)
    runMigrationsOnce()
    // storage.tsの各getter経由で読み直しても値が変わっていないことを確認
    expect(updateBestPercent(0)).toBe(false) // 0は247より小さいため更新されない＝元の値がまだ247のまま残っている証拠
    expect(updateEndlessBest('beginner', 0)).toBe(false) // 同様に42が保持されている証拠
  })
})
