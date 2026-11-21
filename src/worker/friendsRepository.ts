import { generateRoomCode } from '../battle/roomCode'
import type { FriendSummary, IncomingFriendRequest, PublicProfileSnapshot } from '../friends/types'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: friend_codes/friend_requests/
 * friendships/player_public_profilesのD1クエリ層。既存のchallengeRepository.ts・
 * battleRepository.ts・privateRoomRepository.tsと同じ方針（bind()経由のみ）。
 */

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

interface ProfileRow {
  nickname: string
  avatar_json: string
  equipped_title_id: string | null
  has_dopa_pass: number
  best_dopa_percent: number
  endless_beginner_best: number
  endless_intermediate_best: number
  endless_advanced_best: number
  world_battle_wins: number
  achievement_count: number
  updated_at: number
}

function rowToProfile(row: ProfileRow): PublicProfileSnapshot {
  return {
    nickname: row.nickname,
    avatar: JSON.parse(row.avatar_json),
    equippedTitleId: row.equipped_title_id,
    hasDopaPass: row.has_dopa_pass === 1,
    bestDopaPercent: row.best_dopa_percent,
    endlessBeginnerBest: row.endless_beginner_best,
    endlessIntermediateBest: row.endless_intermediate_best,
    endlessAdvancedBest: row.endless_advanced_best,
    worldBattleWins: row.world_battle_wins,
    achievementCount: row.achievement_count,
    updatedAt: row.updated_at,
  }
}

export type SendRequestResult =
  | { status: 'pending' }
  | { status: 'already_friends' }
  | { status: 'rejected'; reason: 'invalid_code' | 'self_request' | 'already_pending' }

export type RespondResult = { ok: true } | { ok: false; reason: 'not_found' }

export interface FriendsRepository {
  upsertPublicProfile(playerId: string, profile: PublicProfileSnapshot): Promise<void>
  getPublicProfile(playerId: string): Promise<PublicProfileSnapshot | null>
  getOrCreateFriendCode(playerId: string, nowMs: number): Promise<string>
  /** codeから申請を送る。自己宛て・既に友達・既にpending中の申請はガードして正常終了する（サーバー側で確実に弾く）。 */
  sendRequestByCode(fromPlayerId: string, toCode: string, nowMs: number): Promise<SendRequestResult>
  listIncomingRequests(playerId: string): Promise<IncomingFriendRequest[]>
  respondToRequest(requestId: string, responderPlayerId: string, action: 'accept' | 'reject', nowMs: number): Promise<RespondResult>
  listFriends(playerId: string): Promise<{ playerId: string; friendSince: number }[]>
  areFriends(playerIdA: string, playerIdB: string): Promise<boolean>
}

export function createD1FriendsRepository(db: D1Database): FriendsRepository {
  return {
    async upsertPublicProfile(playerId, profile) {
      await db
        .prepare(
          `INSERT INTO player_public_profiles
             (player_id, nickname, avatar_json, equipped_title_id, has_dopa_pass, best_dopa_percent,
              endless_beginner_best, endless_intermediate_best, endless_advanced_best, world_battle_wins,
              achievement_count, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (player_id) DO UPDATE SET
             nickname = excluded.nickname,
             avatar_json = excluded.avatar_json,
             equipped_title_id = excluded.equipped_title_id,
             has_dopa_pass = excluded.has_dopa_pass,
             best_dopa_percent = excluded.best_dopa_percent,
             endless_beginner_best = excluded.endless_beginner_best,
             endless_intermediate_best = excluded.endless_intermediate_best,
             endless_advanced_best = excluded.endless_advanced_best,
             world_battle_wins = excluded.world_battle_wins,
             achievement_count = excluded.achievement_count,
             updated_at = excluded.updated_at`,
        )
        .bind(
          playerId,
          profile.nickname,
          JSON.stringify(profile.avatar),
          profile.equippedTitleId,
          profile.hasDopaPass ? 1 : 0,
          profile.bestDopaPercent,
          profile.endlessBeginnerBest,
          profile.endlessIntermediateBest,
          profile.endlessAdvancedBest,
          profile.worldBattleWins,
          profile.achievementCount,
          profile.updatedAt,
        )
        .run()
    },

    async getPublicProfile(playerId) {
      const row = await db.prepare(`SELECT * FROM player_public_profiles WHERE player_id = ?`).bind(playerId).first<ProfileRow>()
      return row ? rowToProfile(row) : null
    },

    async getOrCreateFriendCode(playerId, nowMs) {
      const existing = await db.prepare(`SELECT code FROM friend_codes WHERE player_id = ?`).bind(playerId).first<{ code: string }>()
      if (existing) return existing.code

      // ルームコードと同じ生成方式（crypto.getRandomValues由来）を再利用する。衝突時は
      // UNIQUE制約違反になるため、ごく低確率の再試行ループで吸収する（他のコード生成箇所と
      // 同じ「推測されにくい」特性を保ったまま、衝突だけ安全に回避する）。
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode()
        try {
          await db.prepare(`INSERT INTO friend_codes (player_id, code, created_at) VALUES (?, ?, ?)`).bind(playerId, code, nowMs).run()
          return code
        } catch {
          // UNIQUE制約違反（コード衝突、またはplayer_idの方の行が並行して先に作られた）。
          const retry = await db.prepare(`SELECT code FROM friend_codes WHERE player_id = ?`).bind(playerId).first<{ code: string }>()
          if (retry) return retry.code
        }
      }
      throw new Error('failed to allocate a unique friend code')
    },

    async sendRequestByCode(fromPlayerId, toCode, nowMs) {
      const target = await db.prepare(`SELECT player_id FROM friend_codes WHERE code = ?`).bind(toCode).first<{ player_id: string }>()
      if (!target) return { status: 'rejected', reason: 'invalid_code' }
      const toPlayerId = target.player_id
      if (toPlayerId === fromPlayerId) return { status: 'rejected', reason: 'self_request' }

      const [a, b] = canonicalPair(fromPlayerId, toPlayerId)
      const existingFriendship = await db
        .prepare(`SELECT 1 FROM friendships WHERE player_a_id = ? AND player_b_id = ?`)
        .bind(a, b)
        .first()
      if (existingFriendship) return { status: 'already_friends' }

      // 相手からの未処理の申請が既に存在する場合は、両者が望んでいるのだから即座に
      // 友達にする（わざわざ「お互いに申請を送り合う」手間を要求しない、妥当なUX判断）。
      const reversePending = await db
        .prepare(`SELECT id FROM friend_requests WHERE from_player_id = ? AND to_player_id = ? AND status = 'pending'`)
        .bind(toPlayerId, fromPlayerId)
        .first<{ id: string }>()
      if (reversePending) {
        await db.batch([
          db.prepare(`UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?`).bind(nowMs, reversePending.id),
          db.prepare(`INSERT INTO friendships (player_a_id, player_b_id, created_at) VALUES (?, ?, ?)`).bind(a, b, nowMs),
        ])
        return { status: 'already_friends' }
      }

      const existingPending = await db
        .prepare(`SELECT id FROM friend_requests WHERE from_player_id = ? AND to_player_id = ? AND status = 'pending'`)
        .bind(fromPlayerId, toPlayerId)
        .first()
      if (existingPending) return { status: 'rejected', reason: 'already_pending' }

      await db
        .prepare(`INSERT INTO friend_requests (id, from_player_id, to_player_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`)
        .bind(crypto.randomUUID(), fromPlayerId, toPlayerId, nowMs)
        .run()
      return { status: 'pending' }
    },

    async listIncomingRequests(playerId) {
      const { results } = await db
        .prepare(
          `SELECT r.id as request_id, r.from_player_id, r.created_at, p.*
             FROM friend_requests r
             LEFT JOIN player_public_profiles p ON p.player_id = r.from_player_id
            WHERE r.to_player_id = ? AND r.status = 'pending'
            ORDER BY r.created_at DESC`,
        )
        .bind(playerId)
        .all<ProfileRow & { request_id: string; from_player_id: string; created_at: number }>()
      // player_public_profilesへ一度もアップロードしていない相手からの申請は、公開プロフィールが
      // 存在しないため一覧に出せない（架空のプロフィールを合成しない、という既存の誠実さ方針）。
      return results
        .filter((row) => row.nickname !== null && row.nickname !== undefined)
        .map((row) => ({
          requestId: row.request_id,
          fromPlayerId: row.from_player_id,
          fromProfile: rowToProfile(row),
          createdAt: row.created_at,
        }))
    },

    async respondToRequest(requestId, responderPlayerId, action, nowMs) {
      const request = await db
        .prepare(`SELECT from_player_id, to_player_id FROM friend_requests WHERE id = ? AND status = 'pending'`)
        .bind(requestId)
        .first<{ from_player_id: string; to_player_id: string }>()
      if (!request || request.to_player_id !== responderPlayerId) return { ok: false, reason: 'not_found' }

      if (action === 'reject') {
        await db.prepare(`UPDATE friend_requests SET status = 'rejected', responded_at = ? WHERE id = ?`).bind(nowMs, requestId).run()
        return { ok: true }
      }

      const [a, b] = canonicalPair(request.from_player_id, request.to_player_id)
      await db.batch([
        db.prepare(`UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?`).bind(nowMs, requestId),
        db
          .prepare(`INSERT INTO friendships (player_a_id, player_b_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`)
          .bind(a, b, nowMs),
      ])
      return { ok: true }
    },

    async listFriends(playerId) {
      const { results } = await db
        .prepare(
          `SELECT player_a_id, player_b_id, created_at FROM friendships WHERE player_a_id = ? OR player_b_id = ?`,
        )
        .bind(playerId, playerId)
        .all<{ player_a_id: string; player_b_id: string; created_at: number }>()
      return results.map((row) => ({
        playerId: row.player_a_id === playerId ? row.player_b_id : row.player_a_id,
        friendSince: row.created_at,
      }))
    },

    async areFriends(playerIdA, playerIdB) {
      const [a, b] = canonicalPair(playerIdA, playerIdB)
      const row = await db.prepare(`SELECT 1 FROM friendships WHERE player_a_id = ? AND player_b_id = ?`).bind(a, b).first()
      return row !== null
    },
  }
}

/** listFriends()のplayerId一覧から、一覧画面向けのFriendSummary[]（presence抜き）を組み立てる。presenceはpresenceClient側で別途付与する。 */
export async function buildFriendSummaries(
  repo: FriendsRepository,
  playerId: string,
): Promise<Omit<FriendSummary, 'presence'>[]> {
  const friends = await repo.listFriends(playerId)
  const out: Omit<FriendSummary, 'presence'>[] = []
  for (const f of friends) {
    const profile = await repo.getPublicProfile(f.playerId)
    if (!profile) continue
    out.push({ playerId: f.playerId, profile, friendSince: f.friendSince })
  }
  return out
}
