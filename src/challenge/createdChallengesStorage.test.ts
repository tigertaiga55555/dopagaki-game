import { beforeEach, describe, expect, it } from 'vitest'
import { addCreatedChallengeId, getCreatedChallengeIds } from './createdChallengesStorage'

function installFakeLocalStorage(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
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
}

describe('createdChallengesStorage (Ver.6 Phase 5.3: 送った挑戦状一覧)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態は空配列', () => {
    expect(getCreatedChallengeIds()).toEqual([])
  })

  it('追加したidが新しい順の先頭に積まれる', () => {
    addCreatedChallengeId('id-1')
    addCreatedChallengeId('id-2')
    addCreatedChallengeId('id-3')
    expect(getCreatedChallengeIds()).toEqual(['id-3', 'id-2', 'id-1'])
  })

  it('同じidを再度追加すると、重複させずに先頭へ移動する', () => {
    addCreatedChallengeId('id-1')
    addCreatedChallengeId('id-2')
    addCreatedChallengeId('id-1')
    expect(getCreatedChallengeIds()).toEqual(['id-1', 'id-2'])
  })

  it('Ver.6 Phase 8: 5件を超えると古いものから捨てられる（無料ユーザー直近5件表示の方針、10→5へ変更）', () => {
    for (let i = 0; i < 7; i++) {
      addCreatedChallengeId(`id-${i}`)
    }
    const ids = getCreatedChallengeIds()
    expect(ids.length).toBe(5)
    expect(ids[0]).toBe('id-6')
    expect(ids).not.toContain('id-0')
    expect(ids).not.toContain('id-1')
  })
})
