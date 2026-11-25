import { beforeEach, describe, expect, it } from 'vitest'
import { addParticipatedChallengeId, getParticipatedChallengeIds } from './participatedChallengesStorage'

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

describe('participatedChallengesStorage (Ver.6 Phase 5.4: 参加したChallenge一覧)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態は空配列', () => {
    expect(getParticipatedChallengeIds()).toEqual([])
  })

  it('追加したidが新しい順の先頭に積まれる', () => {
    addParticipatedChallengeId('id-1')
    addParticipatedChallengeId('id-2')
    addParticipatedChallengeId('id-3')
    expect(getParticipatedChallengeIds()).toEqual(['id-3', 'id-2', 'id-1'])
  })

  it('同じidを再度追加すると、重複させずに先頭へ移動する（複数回挑戦しても1件にまとまる）', () => {
    addParticipatedChallengeId('id-1')
    addParticipatedChallengeId('id-2')
    addParticipatedChallengeId('id-1')
    expect(getParticipatedChallengeIds()).toEqual(['id-1', 'id-2'])
  })

  it('次フェーズ（DOPA PASS基盤ラウンド）: 7件保存しても一切切り詰められない（無料/PASSの表示差分はstorage層ではなく表示層utils/historyDisplay.tsが担う）', () => {
    for (let i = 0; i < 7; i++) {
      addParticipatedChallengeId(`id-${i}`)
    }
    const ids = getParticipatedChallengeIds()
    expect(ids.length).toBe(7)
    expect(ids).toContain('id-0')
    expect(ids).toContain('id-6')
  })

  it('createdChallengeIdsとは別のlocalStorageキーを使う（送った/参加したが互いに混在しない）', () => {
    addParticipatedChallengeId('participated-only')
    // 同じテスト内のfakeLocalStorageを直接見て、createdChallengeIdsV1キーには何も書かれていないことを確認する。
    expect(localStorage.getItem('dopagaki:createdChallengeIdsV1')).toBeNull()
    expect(localStorage.getItem('dopagaki:participatedChallengeIdsV1')).not.toBeNull()
  })
})
