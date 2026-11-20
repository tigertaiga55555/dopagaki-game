import { describe, expect, it } from 'vitest'
import {
  PRIVATE_ROOM_MAX_MEMBERS,
  addMember,
  applyMatchResult,
  cancelActiveMatch,
  closeRoom,
  createPrivateRoomState,
  setMemberConnected,
  startMatch,
  type PrivateRoomState,
} from './privateRoomEngine'
import type { BattleOpponentProfile } from './types'

const HOST_PROFILE: BattleOpponentProfile = { nickname: 'Host', avatar: { kind: 'preset', iconId: 'star' }, equippedTitleId: null }

function profileFor(id: string): BattleOpponentProfile {
  return { nickname: id, avatar: { kind: 'preset', iconId: 'flame' }, equippedTitleId: null }
}

function freshRoom(): PrivateRoomState {
  return createPrivateRoomState('ABCDEF', 'host', HOST_PROFILE, 1000)
}

describe('privateRoomEngine: ロビー状態（PRIVATE ROOM、DOPA PASS基盤ラウンド item 15）', () => {
  it('createPrivateRoomStateはformat=FREE・ホストを唯一のメンバーとして開始する', () => {
    const state = freshRoom()
    expect(state.format).toBe('FREE')
    expect(state.members).toHaveLength(1)
    expect(state.members[0].playerId).toBe('host')
    expect(state.closed).toBe(false)
    expect(state.activeMatch).toBeNull()
  })

  it('addMember: 合流は誰でも無料（free users joining is free for everyone）', () => {
    const state = freshRoom()
    const result = addMember(state, 'guest1', profileFor('guest1'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.state.members).toHaveLength(2)
  })

  it(`addMember: 最大${PRIVATE_ROOM_MAX_MEMBERS}人を超えるとfullで拒否される`, () => {
    let state = freshRoom()
    for (let i = 0; i < PRIVATE_ROOM_MAX_MEMBERS - 1; i++) {
      const result = addMember(state, `guest${i}`, profileFor(`guest${i}`))
      expect(result.ok).toBe(true)
      if (result.ok) state = result.state
    }
    expect(state.members).toHaveLength(PRIVATE_ROOM_MAX_MEMBERS)
    const overflow = addMember(state, 'overflow', profileFor('overflow'))
    expect(overflow).toEqual({ ok: false, reason: 'full' })
  })

  it('addMember: 既存メンバーの再合流は満員判定の対象にならず、connectedをtrueに戻す', () => {
    let state = freshRoom()
    state = (addMember(state, 'guest1', profileFor('guest1')) as { ok: true; state: PrivateRoomState }).state
    state = setMemberConnected(state, 'guest1', false)
    const result = addMember(state, 'guest1', profileFor('guest1'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.members).toHaveLength(2)
      expect(result.state.members.find((m) => m.playerId === 'guest1')?.connected).toBe(true)
    }
  })

  it('addMember: closed後は合流できない', () => {
    const state = closeRoom(freshRoom())
    const result = addMember(state, 'guest1', profileFor('guest1'))
    expect(result).toEqual({ ok: false, reason: 'closed' })
  })

  it('startMatch: ホスト以外が開始しようとするとnot_host', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    const result = startMatch(state, 'g1', 'g1', 'g2', 'match-1', 'normal', null)
    expect(result).toEqual({ ok: false, reason: 'not_host' })
  })

  it('startMatch: 既にactiveMatchがある間は2つ目を開始できない（match_in_progress）', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g3', profileFor('g3')) as { ok: true; state: PrivateRoomState }).state
    const first = startMatch(state, 'host', 'g1', 'g2', 'match-1', 'normal', null)
    expect(first.ok).toBe(true)
    state = (first as { ok: true; state: PrivateRoomState }).state
    const second = startMatch(state, 'host', 'g2', 'g3', 'match-2', 'normal', null)
    expect(second).toEqual({ ok: false, reason: 'match_in_progress' })
  })

  it('startMatch: 存在しないメンバーを指定するとmember_not_found', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    const result = startMatch(state, 'host', 'g1', 'ghost', 'match-1', 'normal', null)
    expect(result).toEqual({ ok: false, reason: 'member_not_found' })
  })

  it('applyMatchResult: matchIdが一致する場合だけwins/lossesを加算し、activeMatchを解除する', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    state = (startMatch(state, 'host', 'g1', 'g2', 'match-1', 'normal', null) as { ok: true; state: PrivateRoomState }).state

    state = applyMatchResult(state, 'match-1', 'a')
    expect(state.activeMatch).toBeNull()
    expect(state.members.find((m) => m.playerId === 'g1')?.stats.wins).toBe(1)
    expect(state.members.find((m) => m.playerId === 'g2')?.stats.losses).toBe(1)
  })

  it('applyMatchResult: matchIdが一致しない（既に適用済み）場合は何もしない（べき等性）', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    state = (startMatch(state, 'host', 'g1', 'g2', 'match-1', 'normal', null) as { ok: true; state: PrivateRoomState }).state
    state = applyMatchResult(state, 'match-1', 'draw')

    const second = applyMatchResult(state, 'match-1', 'a')
    expect(second).toEqual(state)
  })

  it('applyMatchResult: drawは両者のdrawsだけを加算する', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    state = (startMatch(state, 'host', 'g1', 'g2', 'match-1', 'normal', null) as { ok: true; state: PrivateRoomState }).state
    state = applyMatchResult(state, 'match-1', 'draw')
    expect(state.members.find((m) => m.playerId === 'g1')?.stats.draws).toBe(1)
    expect(state.members.find((m) => m.playerId === 'g2')?.stats.draws).toBe(1)
  })

  it('cancelActiveMatchはactiveMatchを解除するが、戦績は加算しない', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    state = (startMatch(state, 'host', 'g1', 'g2', 'match-1', 'normal', null) as { ok: true; state: PrivateRoomState }).state
    state = cancelActiveMatch(state)
    expect(state.activeMatch).toBeNull()
    expect(state.members.find((m) => m.playerId === 'g1')?.stats.wins).toBe(0)
  })

  it('closeRoomはclosed=trueにし、以後startMatchはclosedで拒否される', () => {
    let state = freshRoom()
    state = (addMember(state, 'g1', profileFor('g1')) as { ok: true; state: PrivateRoomState }).state
    state = (addMember(state, 'g2', profileFor('g2')) as { ok: true; state: PrivateRoomState }).state
    state = closeRoom(state)
    const result = startMatch(state, 'host', 'g1', 'g2', 'match-1', 'normal', null)
    expect(result).toEqual({ ok: false, reason: 'closed' })
  })
})
