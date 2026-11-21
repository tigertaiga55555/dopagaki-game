/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: private_roomsのD1クエリ層。
 * 既存のbattleRepository.ts/challengeRepository.tsと同じ方針（bind()経由のみ）。
 *
 * コーディネーターからの明示指示: 「1 active PRIVATE ROOM per PASS owner」はサーバー側で
 * 強制する（クライアント側だけの制御にしない）。ここでは、host_player_idをPRIMARY KEYに
 * したmigrations/0006のテーブル自体が、同じホストの2行目挿入を構造的に禁止する——
 * アプリ側のif文（「既にあるかSELECTしてから挿入する」という競合状態のあるロジック）だけに
 * 頼らず、INSERTが制約違反で失敗した場合にそれを正しいサーバー権威の判定として扱う
 * （try/catchでPRIMARY KEY制約違反を捕捉し、既存のroom_codeを返す）。
 */
export type ClaimRoomResult = { ok: true } | { ok: false; existingRoomCode: string }

export interface PrivateRoomRepository {
  /** 新規ルーム作成時に呼ぶ。既にこのホストの行が存在する場合は既存roomCodeを返す（新規作成しない）。 */
  claimRoomForHost(hostPlayerId: string, roomCode: string, nowMs: number): Promise<ClaimRoomResult>
  /** ルームを閉じた時に呼ぶ。以後このホストは新しいルームを作成できるようになる。 */
  releaseRoomForHost(hostPlayerId: string): Promise<void>
  getActiveRoomForHost(hostPlayerId: string): Promise<string | null>
}

export function createD1PrivateRoomRepository(db: D1Database): PrivateRoomRepository {
  return {
    async claimRoomForHost(hostPlayerId, roomCode, nowMs) {
      try {
        await db.prepare(`INSERT INTO private_rooms (host_player_id, room_code, created_at) VALUES (?, ?, ?)`).bind(hostPlayerId, roomCode, nowMs).run()
        return { ok: true }
      } catch {
        const existing = await db.prepare(`SELECT room_code FROM private_rooms WHERE host_player_id = ?`).bind(hostPlayerId).first<{ room_code: string }>()
        return { ok: false, existingRoomCode: existing?.room_code ?? roomCode }
      }
    },

    async releaseRoomForHost(hostPlayerId) {
      await db.prepare(`DELETE FROM private_rooms WHERE host_player_id = ?`).bind(hostPlayerId).run()
    },

    async getActiveRoomForHost(hostPlayerId) {
      const row = await db.prepare(`SELECT room_code FROM private_rooms WHERE host_player_id = ?`).bind(hostPlayerId).first<{ room_code: string }>()
      return row?.room_code ?? null
    },
  }
}
