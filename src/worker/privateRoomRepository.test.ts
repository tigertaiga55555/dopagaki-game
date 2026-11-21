import { describe, expect, it } from 'vitest'
import { createD1PrivateRoomRepository } from './privateRoomRepository'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: privateRoomRepository.ts専用の
 * テストフェイクD1。host_player_idのPRIMARY KEY制約をシミュレートする（同じhost_player_idの
 * 2回目のINSERTはエラーを投げる）——claimRoomForHostのtry/catchフォールバックが
 * 実際のD1制約違反を正しく処理できることを検証するため。
 */
function createPrivateRoomFakeD1Database() {
  const rows = new Map<string, { host_player_id: string; room_code: string; created_at: number }>()

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
        throw new Error(`private room fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
        if (query.startsWith('SELECT room_code FROM private_rooms WHERE host_player_id = ?')) {
          const [hostPlayerId] = boundValues as [string]
          const row = rows.get(hostPlayerId)
          return (row ? { room_code: row.room_code } : null) as T | null
        }
        throw new Error(`private room fake D1: unsupported first() query: ${query}`)
      },
    }
    return stmt
  }

  return { prepare, _rows: rows }
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
})
