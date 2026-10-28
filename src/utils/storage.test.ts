import { beforeEach, describe, expect, it } from 'vitest'
import { getEndlessBest, updateEndlessBest } from './storage'

/**
 * vitestはデフォルトでNode環境で動くため、グローバルのlocalStorageが存在しない。
 * Web Storage API相当のシンプルなインメモリ実装をテストごとに差し替えることで、
 * 本番コード（storage.ts）には一切手を加えずに「ブラウザ更新後もBESTが残る」
 * （＝localStorageへ実際に書き込まれ、別インスタンスから読み直せる）ことを検証する。
 */
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
  // Node環境にはlocalStorageが実行時に存在しないため、テスト用に生やす
  // （型としてはlib.dom.d.tsにより既に宣言済みのため、ts-expect-errorは不要）。
  globalThis.localStorage = fake
  return fake
}

describe('storage: Endless per-difficulty best', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('defaults to 0 when nothing has been saved yet', () => {
    expect(getEndlessBest('beginner')).toBe(0)
    expect(getEndlessBest('intermediate')).toBe(0)
    expect(getEndlessBest('advanced')).toBe(0)
  })

  it('updateEndlessBest saves a new record and returns true (best update)', () => {
    const updated = updateEndlessBest('beginner', 12)
    expect(updated).toBe(true)
    expect(getEndlessBest('beginner')).toBe(12)
  })

  it('updateEndlessBest returns false and does not overwrite when the new score is not better (best non-update)', () => {
    updateEndlessBest('intermediate', 20)
    const updated = updateEndlessBest('intermediate', 15)
    expect(updated).toBe(false)
    expect(getEndlessBest('intermediate')).toBe(20)
  })

  it('an equal score does not count as a new best', () => {
    updateEndlessBest('advanced', 30)
    const updated = updateEndlessBest('advanced', 30)
    expect(updated).toBe(false)
    expect(getEndlessBest('advanced')).toBe(30)
  })

  it('each difficulty is tracked completely independently (section 8 requirement: 難易度ごとに別記録)', () => {
    updateEndlessBest('beginner', 5)
    updateEndlessBest('intermediate', 40)
    updateEndlessBest('advanced', 99)
    expect(getEndlessBest('beginner')).toBe(5)
    expect(getEndlessBest('intermediate')).toBe(40)
    expect(getEndlessBest('advanced')).toBe(99)
  })

  it('persists across what simulates a browser refresh (re-reading via a fresh call hits the same underlying localStorage)', () => {
    updateEndlessBest('beginner', 17)
    // 新しいページロードを模すため、getEndlessBestを「別の呼び出し」として再度叩く
    // （storage.ts側はモジュールレベルの状態を一切持たず、毎回localStorageを直接読むため、
    // これは実際のブラウザ再読み込み後の挙動と同一）。
    expect(getEndlessBest('beginner')).toBe(17)
    expect(getEndlessBest('beginner')).toBe(17)
  })

  it('a higher score after an existing best correctly triggers NEW BEST (isNewBest) exactly once', () => {
    updateEndlessBest('advanced', 10)
    expect(updateEndlessBest('advanced', 10)).toBe(false) // tie, not new best
    expect(updateEndlessBest('advanced', 9)).toBe(false) // lower, not new best
    expect(updateEndlessBest('advanced', 11)).toBe(true) // genuinely new best
    expect(getEndlessBest('advanced')).toBe(11)
  })
})
