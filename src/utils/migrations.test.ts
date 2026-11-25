import { beforeEach, describe, expect, it } from 'vitest'
import { getAchievementCount, isAchievementUnlocked } from './achievementStorage'
import { recordWorldBattleOutcome } from './battleStatsStorage'
import { localHeartRepository } from './heartRepository'
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
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    expect(getAchievementCount()).toBe(8)
  })

  /**
   * 次フェーズ（item 137-140、大型最終仕上げラウンド）: 旧dopa490「最後の一問」は削除し、
   * 「500%クリアの直前に必ず490%を通過している」という推論によるdopa490の遡及解除も
   * 廃止した。新設のSECRET「全部水の泡」（FINAL QUESTIONに到達しながら不正解に終わった、
   * という一度きりの出来事）はbestPercentV4の値からは安全に推論できないため、
   * 遡及解除の対象にしていない——bestPercentV4が500だった既存ユーザーは、通常の
   * dopaPercent系11実績だけが遡及解除される。
   */
  it('v2: bestPercentV4が500（クリア済み）だったユーザーは、dopaPercent系11実績だけが遡及解除される（全部水の泡は推論できないため対象外）', () => {
    updateBestPercent(500)
    runMigrationsOnce()
    expect(isAchievementUnlocked('dopaFinalWipeout')).toBe(false)
    expect(isAchievementUnlocked('dopa500')).toBe(true)
    expect(getAchievementCount()).toBe(11) // dopaPercent系11個のみ
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

  it('v3（Ver.6 Phase 10実績拡張ラウンド）: ENDLESS追加3段（初級150/中級75/上級50）が既存BESTから遡及解除される', () => {
    updateEndlessBest('beginner', 150)
    updateEndlessBest('intermediate', 80)
    updateEndlessBest('advanced', 49)

    runMigrationsOnce()

    expect(isAchievementUnlocked('endlessBeginner150')).toBe(true)
    expect(isAchievementUnlocked('endlessIntermediate75')).toBe(true)
    expect(isAchievementUnlocked('endlessAdvanced50')).toBe(false) // 49は50未満
  })

  it('v3: 既存の世界対戦battleStatsStorage（wins/maxStreak）から勝利数ladder・連勝ladderが遡及解除される', () => {
    // 既存ユーザーが既に10勝・最大5連勝まで記録していた状態を模す。
    for (let i = 0; i < 10; i++) recordWorldBattleOutcome('win')

    runMigrationsOnce()

    expect(isAchievementUnlocked('worldBattleWin1')).toBe(true)
    expect(isAchievementUnlocked('worldBattleWin10')).toBe(true)
    expect(isAchievementUnlocked('worldBattleWin25')).toBe(false)
    expect(isAchievementUnlocked('worldBattleStreak3')).toBe(true)
    expect(isAchievementUnlocked('worldBattleStreak5')).toBe(true)
    expect(isAchievementUnlocked('worldBattleStreak10')).toBe(true)
    expect(isAchievementUnlocked('worldBattleStreak20')).toBe(false)
  })

  it('v3: 世界対戦の初プレイ/初DRAW・ノーミス/完全体・Challenge/Grind系は推測で解除しない（保存されていない事実のため）', () => {
    updateBestPercent(500) // ノーミスの閾値（100/200%）は超えているが、正答率100%だったかは保存されていない
    for (let i = 0; i < 3; i++) recordWorldBattleOutcome('win')

    runMigrationsOnce()

    expect(isAchievementUnlocked('worldBattleFirstPlay')).toBe(false)
    expect(isAchievementUnlocked('worldBattleFirstDraw')).toBe(false)
    expect(isAchievementUnlocked('noMiss100')).toBe(false)
    expect(isAchievementUnlocked('noMiss200')).toBe(false)
    expect(isAchievementUnlocked('challengeCreatedFirst')).toBe(false)
    expect(isAchievementUnlocked('grindPlay10')).toBe(false)
  })

  it('item 18: runMigrationsOnceは新たに解除した実績IDの配列を返す（App.tsx側がAchievementUnlockBannerへそのまま渡し、1〜3件は順番表示・4件以上はサマリーへ自動的にまとまる）', () => {
    updateBestPercent(350) // dopa50/100/120/150/200/250/300/350の8件が同時に解除される→4件以上のサマリー経路
    const unlocked = runMigrationsOnce()
    expect(unlocked.length).toBeGreaterThanOrEqual(4)
    expect(unlocked).toContain('dopa50')
    expect(unlocked).toContain('dopa350')
  })

  it('item 18: 遡及解除が1件も発生しない（新規ユーザー）場合は空配列を返す', () => {
    expect(runMigrationsOnce()).toEqual([])
  })

  it('item 18: 既にCURRENT_MIGRATION_VERSIONへ到達済みの場合、2回目の呼び出しは何も新規解除せず空配列を返す（冪等性）', () => {
    updateBestPercent(350)
    const firstRun = runMigrationsOnce()
    expect(firstRun.length).toBeGreaterThan(0)
    expect(runMigrationsOnce()).toEqual([])
  })

  it('v4（次フェーズ: DOPA HEART本実装、item 18）: Heartデータを持たない既存/新規ユーザーは、移行後に5 Heartから開始する', () => {
    runMigrationsOnce()
    expect(localHeartRepository.getHeartCount()).toBe(5)
  })

  it('v4: 既にHeartを消費済みのユーザーの状態は、マイグレーションで一切書き換えられない', () => {
    localHeartRepository.consumeHeart()
    expect(localHeartRepository.getHeartCount()).toBe(4)
    runMigrationsOnce()
    expect(localHeartRepository.getHeartCount()).toBe(4)
  })
})
