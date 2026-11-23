import { describe, expect, it } from 'vitest'
import { createD1PrivateRoomRepository } from './privateRoomRepository'
import type { PrivateRoomMatchHistoryEntry } from '../battle/privateRoomEngine'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM → FRIENDS/TABLE/ナビ追加調整
 * ラウンド、item 46-47/44で拡張）: privateRoomRepository.ts専用のテストフェイクD1。
 * host_player_idのPRIMARY KEY制約をシミュレートする（同じhost_player_idの2回目のINSERTは
 * エラーを投げる）——claimRoomForHostのtry/catchフォールバックが実際のD1制約違反を
 * 正しく処理できることを検証するため。db.batch()も使うため、トップレベルのbatch()メソッドも
 * 用意する（テスト用途のため、本物のD1のような原子性は実装せず、配列の各文を順番に実行する）。
 */
function createPrivateRoomFakeD1Database() {
  const rows = new Map<string, { host_player_id: string; room_code: string; created_at: number }>()
  const memberships = new Map<string, { player_id: string; room_code: string; joined_at: number }>()
  const sessions: Record<string, unknown>[] = []
  const matchHistoryRows: Record<string, unknown>[] = []
  // item 75-77: (room_code, to_player_id)の複合キーをMapキー文字列化してシミュレートする。
  const invites = new Map<string, { room_code: string; to_player_id: string; from_player_id: string; created_at: number }>()
  const inviteKey = (roomCode: string, toPlayerId: string) => `${roomCode}::${toPlayerId}`

  function prepare(query: string) {
    let boundValues: unknown[] = []
    const stmt = {
      bind(...values: unknown[]) {
        boundValues = values
        return stmt
      },
      async run() {
        if (query.startsWith('INSERT INTO private_rooms')) {
          const [hostPlayerId, roomCode, createdAt] = boundValues as [string, string, number]
          if (rows.has(hostPlayerId)) {
            throw new Error('UNIQUE constraint failed: private_rooms.host_player_id')
          }
          rows.set(hostPlayerId, { host_player_id: hostPlayerId, room_code: roomCode, created_at: createdAt })
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_rooms')) {
          const [hostPlayerId] = boundValues as [string]
          rows.delete(hostPlayerId)
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_memberships')) {
          const [playerId, roomCode, joinedAt] = boundValues as [string, string, number]
          memberships.set(playerId, { player_id: playerId, room_code: roomCode, joined_at: joinedAt })
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_room_memberships')) {
          const [roomCode] = boundValues as [string]
          for (const [playerId, row] of memberships) if (row.room_code === roomCode) memberships.delete(playerId)
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_sessions')) {
          const [id, roomCode, hostPlayerId, createdAt, endedAt, memberCount, matchCount] = boundValues
          sessions.push({ id, room_code: roomCode, host_player_id: hostPlayerId, created_at: createdAt, ended_at: endedAt, member_count: memberCount, match_count: matchCount })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_match_history')) {
          const [id, sessionId, roomCode, tableId] = boundValues
          matchHistoryRows.push({ id, session_id: sessionId, room_code: roomCode, table_id: tableId })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_invites')) {
          const [roomCode, toPlayerId, fromPlayerId, createdAt] = boundValues as [string, string, string, number]
          const key = inviteKey(roomCode, toPlayerId)
          if (invites.has(key)) {
            throw new Error('UNIQUE constraint failed: private_room_invites.room_code, private_room_invites.to_player_id')
          }
          invites.set(key, { room_code: roomCode, to_player_id: toPlayerId, from_player_id: fromPlayerId, created_at: createdAt })
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_room_invites WHERE room_code = ? AND to_player_id = ?')) {
          const [roomCode, toPlayerId] = boundValues as [string, string]
          invites.delete(inviteKey(roomCode, toPlayerId))
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_room_invites WHERE room_code = ?')) {
          const [roomCode] = boundValues as [string]
          for (const [key, row] of invites) if (row.room_code === roomCode) invites.delete(key)
          return { success: true, meta: {} }
        }
        throw new Error(`private room fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
        if (query.startsWith('SELECT room_code FROM private_rooms WHERE host_player_id = ?')) {
          const [hostPlayerId] = boundValues as [string]
          const row = rows.get(hostPlayerId)
          return (row ? { room_code: row.room_code } : null) as T | null
        }
        if (query.startsWith('SELECT room_code FROM private_room_memberships WHERE player_id = ?')) {
          const [playerId] = boundValues as [string]
          const row = memberships.get(playerId)
          return (row ? { room_code: row.room_code } : null) as T | null
        }
        throw new Error(`private room fake D1: unsupported first() query: ${query}`)
      },
      async all<T>() {
        if (query.startsWith('SELECT to_player_id FROM private_room_invites WHERE room_code = ?')) {
          const [roomCode] = boundValues as [string]
          const results = [...invites.values()].filter((r) => r.room_code === roomCode).map((r) => ({ to_player_id: r.to_player_id }))
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT room_code, from_player_id, created_at FROM private_room_invites WHERE to_player_id = ?')) {
          const [toPlayerId] = boundValues as [string]
          const results = [...invites.values()]
            .filter((r) => r.to_player_id === toPlayerId)
            .sort((a, b) => b.created_at - a.created_at)
            .map((r) => ({ room_code: r.room_code, from_player_id: r.from_player_id, created_at: r.created_at }))
          return { results: results as T[], success: true, meta: {} }
        }
        throw new Error(`private room fake D1: unsupported all() query: ${query}`)
      },
    }
    return stmt
  }

  async function batch(statements: { run: () => Promise<unknown> }[]) {
    const out: unknown[] = []
    for (const statement of statements) out.push(await statement.run())
    return out
  }

  return { prepare, batch, _rows: rows, _memberships: memberships, _sessions: sessions, _matchHistoryRows: matchHistoryRows, _invites: invites }
}

function sampleMatch(overrides: Partial<PrivateRoomMatchHistoryEntry> = {}): PrivateRoomMatchHistoryEntry {
  return {
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
    ...overrides,
  }
}

describe('createD1PrivateRoomRepository (DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM)', () => {
  it('claimRoomForHost: 初回は成功する', async () => {
    const db = createPrivateRoomFakeD1Database()
    const repo = createD1PrivateRoomRepository(db as never)
    const result = await repo.claimRoomForHost('host1', 'ABCDEF', 1000)
    expect(result).toEqual({ ok: true })
  })

  it('claimRoomForHost: 同じホストの2回目は既存roomCodeを返す（新規作成しない、サーバー権威の1部屋/ホスト制限）', async () => {
    const db = createPrivateRoomFakeD1Database()
    const repo = createD1PrivateRoomRepository(db as never)
    await repo.claimRoomForHost('host1', 'ABCDEF', 1000)
    const second = await repo.claimRoomForHost('host1', 'ZZZZZZ', 2000)
    expect(second).toEqual({ ok: false, existingRoomCode: 'ABCDEF' })
  })

  it('releaseRoomForHost後は、同じホストが新しいルームを作成できる', async () => {
    const db = createPrivateRoomFakeD1Database()
    const repo = createD1PrivateRoomRepository(db as never)
    await repo.claimRoomForHost('host1', 'ABCDEF', 1000)
    await repo.releaseRoomForHost('host1')
    const result = await repo.claimRoomForHost('host1', 'NEWCODE', 2000)
    expect(result).toEqual({ ok: true })
  })

  it('getActiveRoomForHost: 部屋を持っていなければnull', async () => {
    const db = createPrivateRoomFakeD1Database()
    const repo = createD1PrivateRoomRepository(db as never)
    expect(await repo.getActiveRoomForHost('nobody')).toBeNull()
  })

  it('getActiveRoomForHost: claim済みのroomCodeを返す', async () => {
    const db = createPrivateRoomFakeD1Database()
    const repo = createD1PrivateRoomRepository(db as never)
    await repo.claimRoomForHost('host1', 'ABCDEF', 1000)
    expect(await repo.getActiveRoomForHost('host1')).toBe('ABCDEF')
  })

  it('異なるホストは互いに影響しない（それぞれ1部屋ずつ持てる）', async () => {
    const db = createPrivateRoomFakeD1Database()
    const repo = createD1PrivateRoomRepository(db as never)
    const r1 = await repo.claimRoomForHost('host1', 'AAAAAA', 1000)
    const r2 = await repo.claimRoomForHost('host2', 'BBBBBB', 1000)
    expect(r1).toEqual({ ok: true })
    expect(r2).toEqual({ ok: true })
  })

  describe('item 46-47: private_room_memberships（player_idで今どのルームに居るかを追跡）', () => {
    it('recordMembership後、getActiveRoomForPlayerはroomCode・isHostを返す', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.claimRoomForHost('host1', 'ABCDEF', 1000)
      await repo.recordMembership('host1', 'ABCDEF', 1000)
      expect(await repo.getActiveRoomForPlayer('host1')).toEqual({ roomCode: 'ABCDEF', isHost: true })
    })

    it('ホスト以外のメンバーはisHost=false', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.claimRoomForHost('host1', 'ABCDEF', 1000)
      await repo.recordMembership('guest1', 'ABCDEF', 2000)
      expect(await repo.getActiveRoomForPlayer('guest1')).toEqual({ roomCode: 'ABCDEF', isHost: false })
    })

    it('参加していないplayerIdはnull', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      expect(await repo.getActiveRoomForPlayer('nobody')).toBeNull()
    })

    it('recordMembershipは同じplayerIdの既存行を新しいroomCodeで上書きする（1人1アクティブルーム）', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.recordMembership('p1', 'FIRST1', 1000)
      await repo.recordMembership('p1', 'SECOND', 2000)
      expect(await repo.getActiveRoomForPlayer('p1')).toEqual({ roomCode: 'SECOND', isHost: false })
    })

    it('clearMembershipsForRoomは、そのroomCodeの全メンバーの行を一括で消す', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.recordMembership('p1', 'ABCDEF', 1000)
      await repo.recordMembership('p2', 'ABCDEF', 1000)
      await repo.recordMembership('p3', 'OTHER1', 1000)
      await repo.clearMembershipsForRoom('ABCDEF')
      expect(await repo.getActiveRoomForPlayer('p1')).toBeNull()
      expect(await repo.getActiveRoomForPlayer('p2')).toBeNull()
      expect(await repo.getActiveRoomForPlayer('p3')).toEqual({ roomCode: 'OTHER1', isHost: false })
    })
  })

  describe('item 44: recordClosedRoomSession（ルームが閉じた瞬間の確定済み履歴）', () => {
    it('セッション1行＋試合ごとの詳細行をまとめて書き込む', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.recordClosedRoomSession(
        { roomCode: 'ABCDEF', hostPlayerId: 'host1', createdAt: 1000, endedAt: 9000, memberCount: 3, matchCount: 2 },
        [sampleMatch({ matchId: 'm1' }), sampleMatch({ matchId: 'm2', winner: 'draw' })],
      )
      expect(db._sessions).toHaveLength(1)
      expect(db._sessions[0]).toMatchObject({ room_code: 'ABCDEF', host_player_id: 'host1', member_count: 3, match_count: 2 })
      expect(db._matchHistoryRows).toHaveLength(2)
      expect(db._matchHistoryRows.every((r) => r.session_id === db._sessions[0].id)).toBe(true)
    })

    it('試合が0件のルームでもセッション行だけは書き込まれる', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.recordClosedRoomSession({ roomCode: 'ABCDEF', hostPlayerId: 'host1', createdAt: 1000, endedAt: 2000, memberCount: 1, matchCount: 0 }, [])
      expect(db._sessions).toHaveLength(1)
      expect(db._matchHistoryRows).toHaveLength(0)
    })
  })

  describe('item 75-77: private_room_invites（オフライン配信可能なルーム招待の永続化）', () => {
    it('createRoomInvite後、listPendingInvitesForPlayerに現れる', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend1', 1000)
      expect(await repo.listPendingInvitesForPlayer('friend1')).toEqual([{ roomCode: 'ABCDEF', fromPlayerId: 'host1', createdAt: 1000 }])
    })

    it('同じ(roomCode, toPlayerId)への2回目のcreateRoomInviteは何も変えない（二重送信防止）', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend1', 1000)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend1', 2000)
      const pending = await repo.listPendingInvitesForPlayer('friend1')
      expect(pending).toHaveLength(1)
      expect(pending[0].createdAt).toBe(1000)
    })

    it('listOutgoingInvitesForRoom: そのルームから招待済みのplayerId一覧を返す（ロビーの「招待済み」表示に使う）', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend1', 1000)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend2', 1000)
      await repo.createRoomInvite('OTHER1', 'host2', 'friend3', 1000)
      const outgoing = await repo.listOutgoingInvitesForRoom('ABCDEF')
      expect(outgoing.sort()).toEqual(['friend1', 'friend2'])
    })

    it('deleteRoomInvite: 指定した招待だけを削除する（参加済みになった相手の招待を消す用途）', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend1', 1000)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend2', 1000)
      await repo.deleteRoomInvite('ABCDEF', 'friend1')
      expect(await repo.listPendingInvitesForPlayer('friend1')).toEqual([])
      expect(await repo.listPendingInvitesForPlayer('friend2')).toHaveLength(1)
    })

    it('clearInvitesForRoom: そのルーム宛ての招待を一括で消す（ルームが閉じた/期限切れになった時）', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend1', 1000)
      await repo.createRoomInvite('ABCDEF', 'host1', 'friend2', 1000)
      await repo.createRoomInvite('OTHER1', 'host2', 'friend3', 1000)
      await repo.clearInvitesForRoom('ABCDEF')
      expect(await repo.listPendingInvitesForPlayer('friend1')).toEqual([])
      expect(await repo.listPendingInvitesForPlayer('friend2')).toEqual([])
      expect(await repo.listPendingInvitesForPlayer('friend3')).toHaveLength(1)
    })

    it('招待の無い相手はlistPendingInvitesForPlayerが空配列を返す', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      expect(await repo.listPendingInvitesForPlayer('nobody')).toEqual([])
    })

    it('新しい順（降順）で返す', async () => {
      const db = createPrivateRoomFakeD1Database()
      const repo = createD1PrivateRoomRepository(db as never)
      await repo.createRoomInvite('ROOM01', 'host1', 'friend1', 1000)
      await repo.createRoomInvite('ROOM02', 'host2', 'friend1', 2000)
      const pending = await repo.listPendingInvitesForPlayer('friend1')
      expect(pending.map((p) => p.roomCode)).toEqual(['ROOM02', 'ROOM01'])
    })
  })
})
