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
    }
    return stmt
  }

  async function batch(statements: { run: () => Promise<unknown> }[]) {
    const out: unknown[] = []
    for (const statement of statements) out.push(await statement.run())
    return out
  }

  return { prepare, batch, _rows: rows, _memberships: memberships, _sessions: sessions, _matchHistoryRows: matchHistoryRows }
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
})
