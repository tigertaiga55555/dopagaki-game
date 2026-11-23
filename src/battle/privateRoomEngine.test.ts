import { describe, expect, it } from 'vitest'
import {
  PRIVATE_ROOM_MAX_MEMBERS,
  PRIVATE_ROOM_MAX_TABLES,
  addMember,
  applyMatchResult,
  bothSeatsReady,
  closeRoom,
  createPrivateRoomState,
  enterTable,
  findTableOf,
  isExpired,
  leaveTable,
  setMemberConnected,
  setTableReady,
  setTableRules,
  startTableMatch,
  touchActivity,
  visibleTableCount,
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

function mustAdd(state: PrivateRoomState, playerId: string, nowMs = 1000): PrivateRoomState {
  const result = addMember(state, playerId, profileFor(playerId), nowMs)
  if (!result.ok) throw new Error(`addMember failed: ${result.reason}`)
  return result.state
}

function mustEnter(state: PrivateRoomState, playerId: string, tableId: number): PrivateRoomState {
  const result = enterTable(state, playerId, tableId)
  if (!result.ok) throw new Error(`enterTable failed: ${result.reason}`)
  return result.state
}

describe('privateRoomEngine: ロビー状態（FRIENDS/TABLE/ナビ追加調整ラウンド item 43-45）', () => {
  it('createPrivateRoomStateはformat=FREE・ホストを唯一のメンバーとして開始し、4つの空TABLEを持つ', () => {
    const state = freshRoom()
    expect(state.format).toBe('FREE')
    expect(state.members).toHaveLength(1)
    expect(state.members[0].playerId).toBe('host')
    expect(state.closed).toBe(false)
    expect(state.tables).toHaveLength(PRIVATE_ROOM_MAX_TABLES)
    expect(state.tables.every((t) => t.seatAId === null && t.seatBId === null && t.activeMatch === null)).toBe(true)
    expect(state.matchHistory).toEqual([])
    expect(state.lastActivityAt).toBe(1000)
  })

  it('addMember: 合流は誰でも無料（free users joining is free for everyone）、lastActivityAtを更新する', () => {
    const state = freshRoom()
    const result = addMember(state, 'guest1', profileFor('guest1'), 2000)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.members).toHaveLength(2)
      expect(result.state.lastActivityAt).toBe(2000)
    }
  })

  it(`addMember: 最大${PRIVATE_ROOM_MAX_MEMBERS}人を超えるとfullで拒否される`, () => {
    let state = freshRoom()
    for (let i = 0; i < PRIVATE_ROOM_MAX_MEMBERS - 1; i++) state = mustAdd(state, `guest${i}`)
    expect(state.members).toHaveLength(PRIVATE_ROOM_MAX_MEMBERS)
    const overflow = addMember(state, 'overflow', profileFor('overflow'), 1000)
    expect(overflow).toEqual({ ok: false, reason: 'full' })
  })

  it('addMember: 既存メンバーの再合流は満員判定の対象にならず、connectedをtrueに戻す', () => {
    let state = mustAdd(freshRoom(), 'guest1')
    state = setMemberConnected(state, 'guest1', false)
    const result = addMember(state, 'guest1', profileFor('guest1'), 3000)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.members).toHaveLength(2)
      expect(result.state.members.find((m) => m.playerId === 'guest1')?.connected).toBe(true)
    }
  })

  it('addMember: closed後は合流できない', () => {
    const state = closeRoom(freshRoom())
    const result = addMember(state, 'guest1', profileFor('guest1'), 1000)
    expect(result).toEqual({ ok: false, reason: 'closed' })
  })

  it('setMemberConnected: 切断はロスターから取り除かない（部屋は終了しない）', () => {
    let state = mustAdd(freshRoom(), 'guest1')
    state = setMemberConnected(state, 'host', false)
    expect(state.members).toHaveLength(2)
    expect(state.closed).toBe(false)
    expect(state.members.find((m) => m.playerId === 'host')?.connected).toBe(false)
  })

  it('visibleTableCount: メンバー数に応じて表示すべきTABLE数が決まる（3人→2、8人→4、1人でも最低1）', () => {
    expect(visibleTableCount(1)).toBe(1)
    expect(visibleTableCount(2)).toBe(1)
    expect(visibleTableCount(3)).toBe(2)
    expect(visibleTableCount(4)).toBe(2)
    expect(visibleTableCount(8)).toBe(4)
    expect(visibleTableCount(20)).toBe(PRIVATE_ROOM_MAX_TABLES)
  })

  it('enterTable: 誰でも空席に自分でENTRYできる（ホストの任命は不要）', () => {
    let state = mustAdd(freshRoom(), 'g1')
    const result = enterTable(state, 'g1', 1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const table = findTableOf(result.state, 'g1')
      expect(table?.tableId).toBe(1)
      expect(table?.seatAId).toBe('g1')
    }
  })

  it('enterTable: 2人目は同じTABLEのseatBへ入る', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    const result = enterTable(state, 'g2', 1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const table = findTableOf(result.state, 'g2')
      expect(table?.seatAId).toBe('g1')
      expect(table?.seatBId).toBe('g2')
    }
  })

  it('enterTable: 既に満席のTABLEへはtable_fullで拒否される', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustAdd(state, 'g3')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    const result = enterTable(state, 'g3', 1)
    expect(result).toEqual({ ok: false, reason: 'table_full' })
  })

  it('enterTable: 既に別のTABLEに座っているとalready_seatedで拒否される', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    const result = enterTable(state, 'g1', 2)
    expect(result).toEqual({ ok: false, reason: 'already_seated' })
  })

  it('enterTable: まだ表示されていないTABLEへはinvalid_tableで拒否される（2人しかいないのにTABLE2へ入ろうとする）', () => {
    const state = mustAdd(freshRoom(), 'g1')
    const result = enterTable(state, 'g1', 2)
    expect(result).toEqual({ ok: false, reason: 'invalid_table' })
  })

  it('leaveTable: 対戦開始前ならいつでも離席できる（readyPlayerIdsもリセットされる）', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    const result = leaveTable(state, 'g1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const table = result.state.tables[0]
      expect(table.seatAId).toBeNull()
      expect(table.readyPlayerIds).toEqual([])
    }
  })

  it('leaveTable: 座っていないplayerIdはnot_seated', () => {
    const state = mustAdd(freshRoom(), 'g1')
    expect(leaveTable(state, 'g1')).toEqual({ ok: false, reason: 'not_seated' })
  })

  it('setTableRules: 座っているどちらでも変更できる。変更するとreadyPlayerIdsがリセットされる', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    const result = setTableRules(state, 'g2', 1, 'endless', 'beginner')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.tables[0].battleType).toBe('endless')
      expect(result.state.tables[0].endlessDifficulty).toBe('beginner')
      expect(result.state.tables[0].readyPlayerIds).toEqual([])
    }
  })

  it('setTableRules: 座っていないplayerIdはnot_seated_here', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    const result = setTableRules(state, 'g2', 1, 'endless', 'beginner')
    expect(result).toEqual({ ok: false, reason: 'not_seated_here' })
  })

  it('setTableReady → bothSeatsReady → startTableMatch: 両者READYで初めて対戦が始まる', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    expect(bothSeatsReady(state.tables[0])).toBe(false)
    state = (setTableReady(state, 'g2', 1, true) as { ok: true; state: PrivateRoomState }).state
    expect(bothSeatsReady(state.tables[0])).toBe(true)

    const started = startTableMatch(state, 1, 'match-1')
    expect(started.ok).toBe(true)
    if (started.ok) {
      expect(started.state.tables[0].activeMatch).toEqual({
        matchId: 'match-1',
        battleType: 'normal',
        endlessDifficulty: null,
        memberAId: 'g1',
        memberBId: 'g2',
      })
      expect(started.state.tables[0].readyPlayerIds).toEqual([])
    }
  })

  it('startTableMatch: 両者READYでなければnot_ready', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    expect(startTableMatch(state, 1, 'match-1')).toEqual({ ok: false, reason: 'not_ready' })
  })

  it('複数TABLEが同時に別々のactiveMatchを持てる', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustAdd(state, 'g3')
    state = mustAdd(state, 'g4')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = mustEnter(state, 'g3', 2)
    state = mustEnter(state, 'g4', 2)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g2', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g3', 2, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g4', 2, true) as { ok: true; state: PrivateRoomState }).state
    state = (startTableMatch(state, 1, 'match-1') as { ok: true; state: PrivateRoomState }).state
    state = (startTableMatch(state, 2, 'match-2') as { ok: true; state: PrivateRoomState }).state
    expect(state.tables[0].activeMatch?.matchId).toBe('match-1')
    expect(state.tables[1].activeMatch?.matchId).toBe('match-2')
  })

  it('applyMatchResult: matchIdが一致する場合だけwins/lossesを加算し、該当TABLEのactiveMatchを解除し、履歴へ1件追加する（normal）', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g2', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (startTableMatch(state, 1, 'match-1') as { ok: true; state: PrivateRoomState }).state

    state = applyMatchResult(state, 'match-1', 'a', { playerAFinalDopaPercent: 120, playerBFinalDopaPercent: 80 }, 5000)
    expect(state.tables[0].activeMatch).toBeNull()
    expect(state.members.find((m) => m.playerId === 'g1')?.stats.wins).toBe(1)
    expect(state.members.find((m) => m.playerId === 'g2')?.stats.losses).toBe(1)
    expect(state.matchHistory).toHaveLength(1)
    expect(state.matchHistory[0]).toEqual({
      matchId: 'match-1',
      tableId: 1,
      finishedAt: 5000,
      playerAId: 'g1',
      playerANickname: 'g1',
      playerBId: 'g2',
      playerBNickname: 'g2',
      winner: 'a',
      battleType: 'normal',
      endlessDifficulty: null,
      playerAFinalDopaPercent: 120,
      playerBFinalDopaPercent: 80,
    })
    expect(state.lastActivityAt).toBe(5000)
  })

  it('applyMatchResult: matchIdが一致しない（既に適用済み）場合は何もしない（べき等性）', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g2', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (startTableMatch(state, 1, 'match-1') as { ok: true; state: PrivateRoomState }).state
    state = applyMatchResult(state, 'match-1', 'draw', {}, 2000)

    const second = applyMatchResult(state, 'match-1', 'a', {}, 3000)
    expect(second).toEqual(state)
  })

  it('applyMatchResult: endlessはplayerXStreakだけを記録する（DOPA%は架空の値で埋めない）', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableRules(state, 'g1', 1, 'endless', 'beginner') as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g2', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (startTableMatch(state, 1, 'match-1') as { ok: true; state: PrivateRoomState }).state
    state = applyMatchResult(state, 'match-1', 'b', { playerAStreak: 10, playerBStreak: 20 }, 9000)
    expect(state.matchHistory[0].playerAStreak).toBe(10)
    expect(state.matchHistory[0].playerBStreak).toBe(20)
    expect(state.matchHistory[0].playerAFinalDopaPercent).toBeUndefined()
    expect(state.matchHistory[0].battleType).toBe('endless')
    expect(state.matchHistory[0].endlessDifficulty).toBe('beginner')
  })

  it('closeRoomはclosed=trueにし、進行中のTABLEのactiveMatchをクリアする', () => {
    let state = mustAdd(freshRoom(), 'g1')
    state = mustAdd(state, 'g2')
    state = mustEnter(state, 'g1', 1)
    state = mustEnter(state, 'g2', 1)
    state = (setTableReady(state, 'g1', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (setTableReady(state, 'g2', 1, true) as { ok: true; state: PrivateRoomState }).state
    state = (startTableMatch(state, 1, 'match-1') as { ok: true; state: PrivateRoomState }).state
    state = closeRoom(state)
    expect(state.closed).toBe(true)
    expect(state.tables[0].activeMatch).toBeNull()
    const result = addMember(state, 'late', profileFor('late'), 1000)
    expect(result).toEqual({ ok: false, reason: 'closed' })
  })

  it('isExpired: 最後の活動から6時間以内はfalse、超えるとtrue', () => {
    const state = freshRoom() // lastActivityAt = 1000
    expect(isExpired(state, 1000 + 5 * 60 * 60 * 1000)).toBe(false)
    expect(isExpired(state, 1000 + 6 * 60 * 60 * 1000 + 1)).toBe(true)
  })

  it('touchActivity: lastActivityAtだけを更新する（フレンド招待送信等の活動記録用）', () => {
    const state = touchActivity(freshRoom(), 9999)
    expect(state.lastActivityAt).toBe(9999)
  })
})
