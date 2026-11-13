import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkDopaPercentAchievements,
  checkEndlessAchievements,
  checkEndlessChallengeDefenseAchievement,
  checkEndlessChallengeWinAchievement,
  checkFinalQuestionAchievement,
  getAchievementCount,
  isAchievementUnlocked,
  isTitleUnlocked,
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

describe('achievementStorage (Ver.6 Phase 5.1: DOPA%実績12個＋Endless実績12個＋490特殊実績)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('100 Achievement解除: 100%到達でdopa50・dopa100が解除される', () => {
    const unlocked = checkDopaPercentAchievements(100)
    expect(unlocked).toEqual(['dopa50', 'dopa100'])
    expect(isAchievementUnlocked('dopa100')).toBe(true)
    expect(isAchievementUnlocked('dopa120')).toBe(false)
  })

  it('120 Achievement解除: 120%到達でdopa50/100/120が解除される', () => {
    const unlocked = checkDopaPercentAchievements(120)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120'])
  })

  it('200 Achievement解除: 200%到達でdopa50/100/120/150/200が解除される', () => {
    const unlocked = checkDopaPercentAchievements(200)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200'])
  })

  it('300 Achievement解除: 300%到達でdopa300までが解除される（250も含む）', () => {
    const unlocked = checkDopaPercentAchievements(300)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200', 'dopa250', 'dopa300'])
  })

  it('400 Achievement解除: 400%到達でdopa400までが解除される（350も含む）', () => {
    const unlocked = checkDopaPercentAchievements(400)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200', 'dopa250', 'dopa300', 'dopa350', 'dopa400'])
  })

  it('500 Achievement解除: 500%到達でdopaPercent系11実績が解除される（dopa490は含まれない）', () => {
    const unlocked = checkDopaPercentAchievements(500)
    expect(unlocked).toEqual([
      'dopa50',
      'dopa100',
      'dopa120',
      'dopa150',
      'dopa200',
      'dopa250',
      'dopa300',
      'dopa350',
      'dopa400',
      'dopa450',
      'dopa500',
    ])
    expect(isAchievementUnlocked('dopa490')).toBe(false)
    expect(getAchievementCount()).toBe(11)
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
    expect(getAchievementCount()).toBe(11)
  })

  it('achievementCount: 解除した分だけ正しくカウントされる', () => {
    expect(getAchievementCount()).toBe(0)
    checkDopaPercentAchievements(250) // dopa50/100/120/150/200/250の6個
    expect(getAchievementCount()).toBe(6)
  })

  it('段階的な到達でも、閾値を跨いだ分だけ新規解除として返る', () => {
    expect(checkDopaPercentAchievements(100)).toEqual(['dopa50', 'dopa100'])
    expect(checkDopaPercentAchievements(150)).toEqual(['dopa120', 'dopa150'])
    expect(checkDopaPercentAchievements(140)).toEqual([]) // 既に120/150は解除済み、140は新しい閾値を跨がない
  })

  it('dopa490（FINAL QUESTION）: reached490=falseでは何も解除しない', () => {
    expect(checkFinalQuestionAchievement(false)).toEqual([])
    expect(isAchievementUnlocked('dopa490')).toBe(false)
  })

  it('dopa490（FINAL QUESTION）: reached490=trueで一度だけ解除される。dopa500とは別実績', () => {
    expect(checkFinalQuestionAchievement(true)).toEqual(['dopa490'])
    expect(isAchievementUnlocked('dopa490')).toBe(true)
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    expect(checkFinalQuestionAchievement(true)).toEqual([]) // 重複解除防止
  })

  it('Endless初級STREAK実績: 閾値10/25/50/100を跨いだ分だけ解除される', () => {
    expect(checkEndlessAchievements('beginner', 10)).toEqual(['endlessBeginner10'])
    expect(checkEndlessAchievements('beginner', 30)).toEqual(['endlessBeginner25'])
    expect(checkEndlessAchievements('beginner', 100)).toEqual(['endlessBeginner50', 'endlessBeginner100'])
  })

  it('Endless中級STREAK実績: 閾値5/15/30/50を跨いだ分だけ解除される', () => {
    expect(checkEndlessAchievements('intermediate', 5)).toEqual(['endlessIntermediate5'])
    expect(checkEndlessAchievements('intermediate', 50)).toEqual(['endlessIntermediate15', 'endlessIntermediate30', 'endlessIntermediate50'])
  })

  it('Endless上級STREAK実績: 閾値3/10/20/30を跨いだ分だけ解除される', () => {
    expect(checkEndlessAchievements('advanced', 3)).toEqual(['endlessAdvanced3'])
    expect(checkEndlessAchievements('advanced', 30)).toEqual(['endlessAdvanced10', 'endlessAdvanced20', 'endlessAdvanced30'])
  })

  it('Endless実績は難易度ごとに独立している（他難易度のstreakに影響しない）', () => {
    checkEndlessAchievements('beginner', 100)
    expect(isAchievementUnlocked('endlessIntermediate5')).toBe(false)
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(false)
  })

  it('Title: 対応するAchievementが解除されるとisTitleUnlockedもtrueになる', () => {
    expect(isTitleUnlocked('dopa100')).toBe(false)
    checkDopaPercentAchievements(100)
    expect(isTitleUnlocked('dopa100')).toBe(true)
  })

  it('Title: Endless実績に対応するTitleもunlockedByAchievementId経由で解除される', () => {
    expect(isTitleUnlocked('endlessAdvanced3')).toBe(false)
    checkEndlessAchievements('advanced', 3)
    expect(isTitleUnlocked('endlessAdvanced3')).toBe(true)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない挑戦者」はwon=falseでは解除されない', () => {
    expect(checkEndlessChallengeWinAchievement(false)).toEqual([])
    expect(isAchievementUnlocked('endlessChallengeFirstWin')).toBe(false)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない挑戦者」はwon=trueで一度だけ解除される。endlessStreak系とは独立している', () => {
    expect(checkEndlessChallengeWinAchievement(true)).toEqual(['endlessChallengeFirstWin'])
    expect(isAchievementUnlocked('endlessChallengeFirstWin')).toBe(true)
    expect(checkEndlessChallengeWinAchievement(true)).toEqual([]) // 重複解除防止
    // 通常ENDLESSの連続正解実績には一切影響しない（別の条件種別のため）。
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(false)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない門番」はdefended=falseでは解除されない', () => {
    expect(checkEndlessChallengeDefenseAchievement(false)).toEqual([])
    expect(isAchievementUnlocked('endlessChallengeFirstDefense')).toBe(false)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない門番」はdefended=trueで一度だけ解除される', () => {
    expect(checkEndlessChallengeDefenseAchievement(true)).toEqual(['endlessChallengeFirstDefense'])
    expect(isAchievementUnlocked('endlessChallengeFirstDefense')).toBe(true)
    expect(checkEndlessChallengeDefenseAchievement(true)).toEqual([]) // 重複解除防止
  })

  it('Ver.6 Phase 8: 通常ENDLESSの連続正解実績を解除しても、ENDLESS Challenge専用の2実績には一切影響しない', () => {
    checkEndlessAchievements('advanced', 30)
    expect(isAchievementUnlocked('endlessChallengeFirstWin')).toBe(false)
    expect(isAchievementUnlocked('endlessChallengeFirstDefense')).toBe(false)
  })
})
