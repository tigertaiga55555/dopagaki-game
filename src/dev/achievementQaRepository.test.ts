import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  qaLockAllAchievements,
  qaLockSecretAchievements,
  qaUnlockAchievementsByRarity,
  qaUnlockAllAchievements,
  qaUnlockSecretAchievements,
} from './achievementQaRepository'
import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { getUnlockedAchievements, isAchievementUnlocked } from '../utils/achievementStorage'

function installFakeLocalStorage() {
  const store = new Map<string, string>()
  const fake: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  globalThis.localStorage = fake
  return fake
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 116: リリース前最終デザインラウンド）:
 * Achievement/Title QAパネルの直接操作のユニットテスト。
 *
 * 「単にUIから隠すだけでなく、Production buildでは機能自体が動作しない」ことを、
 * __DOPAGAKI_PREVIEW_ENABLED__をvi.stubGlobalでfalseへ差し替えたテストケースで
 * 直接確認する——UIの表示/非表示をテストするだけでは、本当に機能が無効化されているかは
 * 保証できないため。
 */
describe('achievementQaRepository（item 116）', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Preview有効時: qaUnlockAllAchievementsで全実績が解除される', () => {
    qaUnlockAllAchievements()
    expect(Object.keys(getUnlockedAchievements())).toHaveLength(ACHIEVEMENT_DEFS.length)
  })

  it('Preview有効時: qaLockAllAchievementsで全実績がロック状態へ戻る', () => {
    qaUnlockAllAchievements()
    qaLockAllAchievements()
    expect(Object.keys(getUnlockedAchievements())).toHaveLength(0)
  })

  it('Preview有効時: qaUnlockSecretAchievements/qaLockSecretAchievementsはSECRETだけを操作する（他の解除状態に影響しない）', () => {
    qaUnlockAllAchievements()
    qaLockSecretAchievements()
    expect(isAchievementUnlocked('battleMirrorMatch')).toBe(false)
    expect(isAchievementUnlocked('battleComeback')).toBe(false)
    expect(isAchievementUnlocked('dopa50')).toBe(true)

    qaUnlockSecretAchievements()
    expect(isAchievementUnlocked('battleMirrorMatch')).toBe(true)
    expect(isAchievementUnlocked('battleComeback')).toBe(true)
  })

  it('Preview有効時: qaUnlockAchievementsByRarityは指定したTitleレアリティのAchievementだけを解除する', () => {
    qaUnlockAchievementsByRarity('mythic')
    const unlocked = Object.keys(getUnlockedAchievements())
    // MYTHIC Titleは dopa500 / worldBattleWin250 / grindPlay1000 / battleMirrorMatch / battleComeback /
    // endlessAdvanced50（item 128で追加）の6個。
    expect(unlocked.sort()).toEqual(
      ['battleComeback', 'battleMirrorMatch', 'dopa500', 'grindPlay1000', 'worldBattleWin250', 'endlessAdvanced50'].sort(),
    )
  })

  it('Production相当（__DOPAGAKI_PREVIEW_ENABLED__=false）: qaUnlockAllAchievementsは何もしない（構造的に無効化されている）', () => {
    vi.stubGlobal('__DOPAGAKI_PREVIEW_ENABLED__', false)
    qaUnlockAllAchievements()
    expect(Object.keys(getUnlockedAchievements())).toHaveLength(0)
  })

  it('Production相当: qaUnlockSecretAchievements/qaUnlockAchievementsByRarity/qaLockAllAchievementsのいずれも何もしない', () => {
    vi.stubGlobal('__DOPAGAKI_PREVIEW_ENABLED__', false)
    qaUnlockSecretAchievements()
    qaUnlockAchievementsByRarity('mythic')
    expect(Object.keys(getUnlockedAchievements())).toHaveLength(0)

    vi.stubGlobal('__DOPAGAKI_PREVIEW_ENABLED__', true)
    qaUnlockAllAchievements()
    vi.stubGlobal('__DOPAGAKI_PREVIEW_ENABLED__', false)
    qaLockAllAchievements()
    // Production相当の間はロックもされない＝直前にPreview有効時で解除した状態がそのまま残る。
    expect(Object.keys(getUnlockedAchievements())).toHaveLength(ACHIEVEMENT_DEFS.length)
  })
})
