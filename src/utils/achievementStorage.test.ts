import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkDopaPercentAchievements,
  getAchievementCount,
  isAchievementUnlocked,
  unlockAchievement,
} from './achievementStorage'

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

describe('achievementStorage (Ver.6 Phase 5: DOPA%実績6個)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('100 Achievement解除: 100%到達でdopa100だけが解除される', () => {
    const unlocked = checkDopaPercentAchievements(100)
    expect(unlocked).toEqual(['dopa100'])
    expect(isAchievementUnlocked('dopa100')).toBe(true)
    expect(isAchievementUnlocked('dopa120')).toBe(false)
  })

  it('120 Achievement解除: 120%到達でdopa100・dopa120の両方が解除される', () => {
    const unlocked = checkDopaPercentAchievements(120)
    expect(unlocked).toEqual(['dopa100', 'dopa120'])
  })

  it('200 Achievement解除: 200%到達でdopa100/120/200が解除される', () => {
    const unlocked = checkDopaPercentAchievements(200)
    expect(unlocked).toEqual(['dopa100', 'dopa120', 'dopa200'])
  })

  it('300 Achievement解除: 300%到達でdopa300までが解除される', () => {
    const unlocked = checkDopaPercentAchievements(300)
    expect(unlocked).toEqual(['dopa100', 'dopa120', 'dopa200', 'dopa300'])
  })

  it('400 Achievement解除: 400%到達でdopa400までが解除される', () => {
    const unlocked = checkDopaPercentAchievements(400)
    expect(unlocked).toEqual(['dopa100', 'dopa120', 'dopa200', 'dopa300', 'dopa400'])
  })

  it('500 Achievement解除: 500%到達で全6実績が解除される', () => {
    const unlocked = checkDopaPercentAchievements(500)
    expect(unlocked).toEqual(['dopa100', 'dopa120', 'dopa200', 'dopa300', 'dopa400', 'dopa500'])
    expect(getAchievementCount()).toBe(6)
  })

  it('achievement重複解除防止: 同じ実績を2回解除しようとしても2回目は何も起きない', () => {
    expect(unlockAchievement('dopa100')).toBe(true)
    expect(unlockAchievement('dopa100')).toBe(false)
    expect(getAchievementCount()).toBe(1)
  })

  it('achievement重複解除防止: checkDopaPercentAchievementsを同じ%で2回呼んでも2回目は空配列', () => {
    checkDopaPercentAchievements(500)
    const second = checkDopaPercentAchievements(500)
    expect(second).toEqual([])
    expect(getAchievementCount()).toBe(6)
  })

  it('achievementCount: 解除した分だけ正しくカウントされる', () => {
    expect(getAchievementCount()).toBe(0)
    checkDopaPercentAchievements(250) // dopa100/120/200のみ
    expect(getAchievementCount()).toBe(3)
  })

  it('段階的な到達でも、閾値を跨いだ分だけ新規解除として返る', () => {
    expect(checkDopaPercentAchievements(100)).toEqual(['dopa100'])
    expect(checkDopaPercentAchievements(150)).toEqual(['dopa120'])
    expect(checkDopaPercentAchievements(140)).toEqual([]) // 既に120は解除済み、140は新しい閾値を跨がない
  })
})
