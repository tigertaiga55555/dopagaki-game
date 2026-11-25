import { describe, expect, it } from 'vitest'
import { createMatchmakerState, dequeue, enqueue, findTimedOut, isQueued, tryMatch } from './matchmakerEngine'
import type { BattleOpponentProfile } from './types'

const PROFILE: BattleOpponentProfile = { nickname: 'テスト太郎', avatar: { kind: 'preset', iconId: 'star' }, equippedTitleId: null }

describe('matchmakerEngine (Ver.6 Phase 6: 世界対戦マッチング)', () => {
  it('2人未満ではtryMatchがnullを返す', () => {
    let state = createMatchmakerState()
    state = enqueue(state, { playerId: 'a', profile: PROFILE, joinedAt: 0 })
    expect(tryMatch(state)).toBeNull()
  })

  it('2人以上いれば先頭2人がマッチし、両者とも待機列から取り除かれる', () => {
    let state = createMatchmakerState()
    state = enqueue(state, { playerId: 'a', profile: PROFILE, joinedAt: 0 })
    state = enqueue(state, { playerId: 'b', profile: PROFILE, joinedAt: 1 })
    state = enqueue(state, { playerId: 'c', profile: PROFILE, joinedAt: 2 })

    const result = tryMatch(state)
    expect(result).not.toBeNull()
    expect(result!.pair.a.playerId).toBe('a')
    expect(result!.pair.b.playerId).toBe('b')
    expect(result!.state.queue.map((e) => e.playerId)).toEqual(['c'])
  })

  it('同一playerIdを重複して登録しない（再度enqueueすると既存分が置き換わる）', () => {
    let state = createMatchmakerState()
    state = enqueue(state, { playerId: 'a', profile: PROFILE, joinedAt: 0 })
    state = enqueue(state, { playerId: 'a', profile: PROFILE, joinedAt: 100 })
    expect(state.queue.length).toBe(1)
    expect(state.queue[0].joinedAt).toBe(100)
  })

  it('同じplayerが同時に複数試合へ割り当てられない: tryMatchで取り除かれた2人は次のtryMatchの対象に含まれない', () => {
    let state = createMatchmakerState()
    state = enqueue(state, { playerId: 'a', profile: PROFILE, joinedAt: 0 })
    state = enqueue(state, { playerId: 'b', profile: PROFILE, joinedAt: 1 })
    const first = tryMatch(state)!
    expect(isQueued(first.state, 'a')).toBe(false)
    expect(isQueued(first.state, 'b')).toBe(false)
    expect(tryMatch(first.state)).toBeNull()
  })

  it('dequeue: キャンセル/切断時に待機列から外せる', () => {
    let state = createMatchmakerState()
    state = enqueue(state, { playerId: 'a', profile: PROFILE, joinedAt: 0 })
    state = dequeue(state, 'a')
    expect(isQueued(state, 'a')).toBe(false)
  })

  it('findTimedOut: 15秒(timeoutMs)以上待っているentryだけを返す', () => {
    let state = createMatchmakerState()
    state = enqueue(state, { playerId: 'old', profile: PROFILE, joinedAt: 0 })
    state = enqueue(state, { playerId: 'new', profile: PROFILE, joinedAt: 10000 })
    const timedOut = findTimedOut(state, 15000, 15000)
    expect(timedOut.map((e) => e.playerId)).toEqual(['old'])
  })
})
