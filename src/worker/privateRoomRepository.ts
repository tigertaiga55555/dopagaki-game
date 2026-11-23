import type { PrivateRoomMatchHistoryEntry } from '../battle/privateRoomEngine'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM → FRIENDS/TABLE/ナビ追加調整
 * ラウンド、item 44/46-47で拡張）: private_rooms（ホストの1部屋制限）・
 * private_room_memberships（誰が今どの部屋に居るか、player_idキー）・
 * private_room_sessions/private_room_match_history（閉じた/期限切れになったルームの
 * 確定済み履歴）のD1クエリ層。既存のbattleRepository.ts/challengeRepository.tsと同じ方針
 * （bind()経由のみ）。
 *
 * コーディネーターからの明示指示: 「1 active PRIVATE ROOM per PASS owner」はサーバー側で
 * 強制する（クライアント側だけの制御にしない）。ここでは、host_player_idをPRIMARY KEYに
 * したmigrations/0006のテーブル自体が、同じホストの2行目挿入を構造的に禁止する——
 * アプリ側のif文（「既にあるかSELECTしてから挿入する」という競合状態のあるロジック）だけに
 * 頼らず、INSERTが制約違反で失敗した場合にそれを正しいサーバー権威の判定として扱う
 * （try/catchでPRIMARY KEY制約違反を捕捉し、既存のroom_codeを返す）。
 *
 * item 46-47: private_room_membershipsは「今、誰がどのルームに参加中か」をplayer_id
 * （既存の匿名アカウント基盤）で追跡する、サーバー権威の最小限の状態。将来の実アカウント
 * 移行時も、player_idの意味自体は変わらないため、この設計をそのまま延長できる。
 */
export type ClaimRoomResult = { ok: true } | { ok: false; existingRoomCode: string }

export interface ActiveRoomForPlayer {
  roomCode: string
  isHost: boolean
}

export interface ClosedRoomSession {
  roomCode: string
  hostPlayerId: string
  createdAt: number
  endedAt: number
  memberCount: number
  matchCount: number
}

export interface PrivateRoomRepository {
  /** 新規ルーム作成時に呼ぶ。既にこのホストの行が存在する場合は既存roomCodeを返す（新規作成しない）。 */
  claimRoomForHost(hostPlayerId: string, roomCode: string, nowMs: number): Promise<ClaimRoomResult>
  /** ルームを閉じた時に呼ぶ。以後このホストは新しいルームを作成できるようになる。 */
  releaseRoomForHost(hostPlayerId: string): Promise<void>
  getActiveRoomForHost(hostPlayerId: string): Promise<string | null>

  /** item 46-47: 合流（ホストの作成を含む）のたびに呼ぶ。同じplayer_idの既存行は上書きする（1プレイヤー1アクティブルーム）。 */
  recordMembership(playerId: string, roomCode: string, nowMs: number): Promise<void>
  /** item 46-47: 「友達と対戦」を開いた時、ホーム画面に「参加中のルームに戻る」を優先表示するための問い合わせ。 */
  getActiveRoomForPlayer(playerId: string): Promise<ActiveRoomForPlayer | null>
  /** item 46-47: ルームが閉じた/期限切れになった瞬間、そのルームの全メンバーの行を一括で消す。 */
  clearMembershipsForRoom(roomCode: string): Promise<void>

  /** item 44: ルームが閉じた/期限切れになった瞬間に1回だけ呼ぶ。セッションサマリー＋試合履歴detailをまとめて書き込む。 */
  recordClosedRoomSession(session: ClosedRoomSession, matches: PrivateRoomMatchHistoryEntry[]): Promise<void>
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

    async recordMembership(playerId, roomCode, nowMs) {
      await db
        .prepare(
          `INSERT INTO private_room_memberships (player_id, room_code, joined_at) VALUES (?, ?, ?)
           ON CONFLICT(player_id) DO UPDATE SET room_code = excluded.room_code, joined_at = excluded.joined_at`,
        )
        .bind(playerId, roomCode, nowMs)
        .run()
    },

    async getActiveRoomForPlayer(playerId) {
      const membership = await db
        .prepare(`SELECT room_code FROM private_room_memberships WHERE player_id = ?`)
        .bind(playerId)
        .first<{ room_code: string }>()
      if (!membership) return null
      const hostRow = await db.prepare(`SELECT room_code FROM private_rooms WHERE host_player_id = ?`).bind(playerId).first<{ room_code: string }>()
      return { roomCode: membership.room_code, isHost: hostRow?.room_code === membership.room_code }
    },

    async clearMembershipsForRoom(roomCode) {
      await db.prepare(`DELETE FROM private_room_memberships WHERE room_code = ?`).bind(roomCode).run()
    },

    async recordClosedRoomSession(session, matches) {
      const sessionId = crypto.randomUUID()
      const statements = [
        db
          .prepare(
            `INSERT INTO private_room_sessions (id, room_code, host_player_id, created_at, ended_at, member_count, match_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(sessionId, session.roomCode, session.hostPlayerId, session.createdAt, session.endedAt, session.memberCount, session.matchCount),
        ...matches.map((m) =>
          db
            .prepare(
              `INSERT INTO private_room_match_history
                 (id, session_id, room_code, table_id, finished_at, player_a_id, player_a_nickname, player_b_id, player_b_nickname,
                  winner, battle_type, endless_difficulty, player_a_final_dopa_percent, player_b_final_dopa_percent, player_a_streak, player_b_streak)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              sessionId,
              session.roomCode,
              m.tableId,
              m.finishedAt,
              m.playerAId,
              m.playerANickname,
              m.playerBId,
              m.playerBNickname,
              m.winner,
              m.battleType,
              m.endlessDifficulty,
              m.playerAFinalDopaPercent ?? null,
              m.playerBFinalDopaPercent ?? null,
              m.playerAStreak ?? null,
              m.playerBStreak ?? null,
            ),
        ),
      ]
      await db.batch(statements)
    },
  }
}
