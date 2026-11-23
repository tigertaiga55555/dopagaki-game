/**
 * Ver.6 Phase 5.1/5.2/5.3（Challengeバックエンド基盤→機能完成→勝敗判定強化）: テスト専用の
 * 最小限D1フェイク。
 *
 * 本物のD1 SQLパーサは実装せず、challengeRepository.tsが実際に発行するクエリ
 * （challenges / challenge_attemptsそれぞれのINSERT・SELECT・集計）だけを認識するごく単純な
 * インメモリstoreとして振る舞う。D1Database自体はabstract classのため、テストでは
 * このフェイクをD1Databaseとして直接castして使う（Cloudflareの実D1を起動せずに
 * Workerのルーティング・リポジトリ層を検証するため）。
 */
export function createFakeD1Database() {
  const rows = new Map<string, Record<string, unknown>>()
  const attemptRows: Record<string, unknown>[] = []
  // 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: private_rooms
  // （host_player_idがPRIMARY KEY）。他のテーブルとは無関係に追加しただけで、既存の
  // Challenge関連クエリ照合には一切影響しない。
  const privateRooms = new Map<string, { host_player_id: string; room_code: string; created_at: number }>()
  // 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 46-47）: private_room_memberships
  // （player_idがPRIMARY KEY、今どのルームに居るか）。
  const privateRoomMemberships = new Map<string, { player_id: string; room_code: string; joined_at: number }>()
  // 次フェーズ（ゲーム機能クローズラウンド、item 75-77）: private_room_invites
  // （(room_code, to_player_id)が複合キー）。
  const privateRoomInvites = new Map<string, { room_code: string; to_player_id: string; from_player_id: string; created_at: number }>()
  const inviteKey = (roomCode: string, toPlayerId: string) => `${roomCode}::${toPlayerId}`
  // item 75-77: POST /api/rooms/private/:roomCode/inviteがareFriends/getPublicProfileも
  // 必要とするため、friendsTestFakeD1.tsの最小限サブセットだけをここにも用意する
  // （friendshipsはplayer_a_id < player_b_idの正準順で1行だけ保持する）。
  const friendships = new Set<string>()
  const publicProfiles = new Map<string, Record<string, unknown>>()
  const friendshipKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`)

  function prepare(query: string) {
    let boundValues: unknown[] = []
    const stmt = {
      bind(...values: unknown[]) {
        boundValues = values
        return stmt
      },
      async run() {
        if (query.startsWith('INSERT INTO challenges')) {
          const [
            id,
            creator_player_id,
            creator_nickname,
            creator_icon_kind,
            creator_icon_value,
            creator_equipped_title,
            mode,
            problem_set,
            conditions,
            creator_score,
            created_at,
            performance_final_dopa_percent,
            performance_base_dopa_percent,
            performance_accuracy,
            performance_max_combo,
            performance_median_reaction_ms,
          ] = boundValues
          rows.set(id as string, {
            id,
            creator_player_id,
            creator_nickname,
            creator_icon_kind,
            creator_icon_value,
            creator_equipped_title,
            mode,
            problem_set,
            conditions,
            creator_score,
            created_at,
            performance_final_dopa_percent,
            performance_base_dopa_percent,
            performance_accuracy,
            performance_max_combo,
            performance_median_reaction_ms,
          })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO challenge_attempts')) {
          const [
            id,
            challenge_id,
            player_id,
            nickname,
            icon_kind,
            icon_value,
            equipped_title,
            score,
            result,
            attempt_number,
            created_at,
            performance_final_dopa_percent,
            performance_base_dopa_percent,
            performance_accuracy,
            performance_max_combo,
            performance_median_reaction_ms,
            decided_by,
          ] = boundValues
          attemptRows.push({
            id,
            challenge_id,
            player_id,
            nickname,
            icon_kind,
            icon_value,
            equipped_title,
            score,
            result,
            attempt_number,
            created_at,
            performance_final_dopa_percent,
            performance_base_dopa_percent,
            performance_accuracy,
            performance_max_combo,
            performance_median_reaction_ms,
            decided_by,
          })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_rooms')) {
          const [hostPlayerId, roomCode, createdAt] = boundValues as [string, string, number]
          if (privateRooms.has(hostPlayerId)) {
            throw new Error('UNIQUE constraint failed: private_rooms.host_player_id')
          }
          privateRooms.set(hostPlayerId, { host_player_id: hostPlayerId, room_code: roomCode, created_at: createdAt })
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_rooms')) {
          const [hostPlayerId] = boundValues as [string]
          privateRooms.delete(hostPlayerId)
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_memberships')) {
          const [playerId, roomCode, joinedAt] = boundValues as [string, string, number]
          privateRoomMemberships.set(playerId, { player_id: playerId, room_code: roomCode, joined_at: joinedAt })
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_room_memberships')) {
          const [roomCode] = boundValues as [string]
          for (const [playerId, row] of privateRoomMemberships) if (row.room_code === roomCode) privateRoomMemberships.delete(playerId)
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_sessions') || query.startsWith('INSERT INTO private_room_match_history')) {
          // ルート層のテストでは履歴の書き込み内容自体までは検証しない（privateRoomRepository.test.tsで既に検証済み）。
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO private_room_invites')) {
          const [roomCode, toPlayerId, fromPlayerId, createdAt] = boundValues as [string, string, string, number]
          const key = inviteKey(roomCode, toPlayerId)
          if (privateRoomInvites.has(key)) throw new Error('UNIQUE constraint failed: private_room_invites')
          privateRoomInvites.set(key, { room_code: roomCode, to_player_id: toPlayerId, from_player_id: fromPlayerId, created_at: createdAt })
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_room_invites WHERE room_code = ? AND to_player_id = ?')) {
          const [roomCode, toPlayerId] = boundValues as [string, string]
          privateRoomInvites.delete(inviteKey(roomCode, toPlayerId))
          return { success: true, meta: {} }
        }
        if (query.startsWith('DELETE FROM private_room_invites WHERE room_code = ?')) {
          const [roomCode] = boundValues as [string]
          for (const [key, row] of privateRoomInvites) if (row.room_code === roomCode) privateRoomInvites.delete(key)
          return { success: true, meta: {} }
        }
        // item 75-77: テストのセットアップ用（本番のfriendsRepository.tsは専用のON CONFLICT文を使うが、
        // このルート層テストでは「既に友達である」という前提条件を作れればよいので最小限でよい）。
        if (query.startsWith('INSERT INTO friendships')) {
          const [a, b] = boundValues as [string, string]
          friendships.add(friendshipKey(a, b))
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO player_public_profiles')) {
          const [playerId, nickname, avatarJson] = boundValues as [string, string, string]
          publicProfiles.set(playerId, {
            nickname,
            avatar_json: avatarJson,
            equipped_title_id: null,
            has_dopa_pass: 0,
            best_dopa_percent: 0,
            endless_beginner_best: 0,
            endless_intermediate_best: 0,
            endless_advanced_best: 0,
            world_battle_wins: 0,
            achievement_count: 0,
            updated_at: Date.now(),
          })
          return { success: true, meta: {} }
        }
        throw new Error(`fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
        if (query.startsWith('SELECT room_code FROM private_rooms WHERE host_player_id = ?')) {
          const [hostPlayerId] = boundValues as [string]
          const row = privateRooms.get(hostPlayerId)
          return (row ? { room_code: row.room_code } : null) as T | null
        }
        if (query.startsWith('SELECT room_code FROM private_room_memberships WHERE player_id = ?')) {
          const [playerId] = boundValues as [string]
          const row = privateRoomMemberships.get(playerId)
          return (row ? { room_code: row.room_code } : null) as T | null
        }
        if (query.startsWith('SELECT 1 FROM friendships WHERE player_a_id = ? AND player_b_id = ?')) {
          const [a, b] = boundValues as [string, string]
          return (friendships.has(friendshipKey(a, b)) ? ({ '1': 1 } as unknown as T) : null)
        }
        if (query.startsWith('SELECT * FROM player_public_profiles WHERE player_id = ?')) {
          const [playerId] = boundValues as [string]
          return (publicProfiles.get(playerId) as T | undefined) ?? null
        }
        if (query.startsWith('SELECT * FROM challenges WHERE id = ?')) {
          const id = boundValues[0] as string
          return (rows.get(id) as T | undefined) ?? null
        }
        if (query.startsWith('SELECT COUNT(*) as cnt FROM challenge_attempts WHERE challenge_id = ? AND player_id = ?')) {
          const [challengeId, playerId] = boundValues as [string, string]
          const cnt = attemptRows.filter((r) => r.challenge_id === challengeId && r.player_id === playerId).length
          return { cnt } as T
        }
        if (query.startsWith('SELECT COUNT(*) as cnt FROM challenge_attempts WHERE challenge_id = ?')) {
          const [challengeId] = boundValues as [string]
          const cnt = attemptRows.filter((r) => r.challenge_id === challengeId).length
          return { cnt } as T
        }
        throw new Error(`fake D1: unsupported first() query: ${query}`)
      },
      async all<T>() {
        if (query.startsWith('SELECT to_player_id FROM private_room_invites WHERE room_code = ?')) {
          const [roomCode] = boundValues as [string]
          const results = [...privateRoomInvites.values()].filter((r) => r.room_code === roomCode).map((r) => ({ to_player_id: r.to_player_id }))
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT room_code, from_player_id, created_at FROM private_room_invites WHERE to_player_id = ?')) {
          const [toPlayerId] = boundValues as [string]
          const results = [...privateRoomInvites.values()]
            .filter((r) => r.to_player_id === toPlayerId)
            .sort((a, b) => b.created_at - a.created_at)
            .map((r) => ({ room_code: r.room_code, from_player_id: r.from_player_id, created_at: r.created_at }))
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT * FROM challenges WHERE id IN')) {
          const ids = boundValues as string[]
          const results = ids.map((id) => rows.get(id)).filter((row): row is Record<string, unknown> => row !== undefined)
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT * FROM challenge_attempts WHERE challenge_id = ? AND player_id = ? ORDER BY created_at DESC LIMIT ?')) {
          const [challengeId, playerId, limit] = boundValues as [string, string, number]
          const results = attemptRows
            .filter((r) => r.challenge_id === challengeId && r.player_id === playerId)
            .sort((a, b) => (b.created_at as number) - (a.created_at as number))
            .slice(0, limit)
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT * FROM challenge_attempts WHERE challenge_id = ? ORDER BY created_at DESC LIMIT ?')) {
          const [challengeId, limit] = boundValues as [string, number]
          const results = attemptRows
            .filter((r) => r.challenge_id === challengeId)
            .sort((a, b) => (b.created_at as number) - (a.created_at as number))
            .slice(0, limit)
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT challenge_id, result, created_at FROM challenge_attempts')) {
          const [playerId, ...ids] = boundValues as [string, ...string[]]
          const results = attemptRows
            .filter((r) => r.player_id === playerId && ids.includes(r.challenge_id as string))
            .sort((a, b) => (a.created_at as number) - (b.created_at as number))
            .map((r) => ({ challenge_id: r.challenge_id, result: r.result, created_at: r.created_at }))
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.includes('FROM challenge_attempts') && query.includes('GROUP BY challenge_id')) {
          const ids = boundValues as string[]
          const results = ids.map((challengeId) => {
            const rowsForChallenge = attemptRows.filter((r) => r.challenge_id === challengeId)
            const challengerCount = new Set(rowsForChallenge.map((r) => r.player_id)).size
            const clearedPlayers = new Set(rowsForChallenge.filter((r) => r.result === 'win').map((r) => r.player_id))
            const defeatedCount = rowsForChallenge.filter((r) => r.result === 'lose').length
            return {
              challenge_id: challengeId,
              challenger_count: challengerCount,
              attempt_count: rowsForChallenge.length,
              cleared_count: clearedPlayers.size,
              defeated_count: defeatedCount,
            }
          })
          // 本物のGROUP BYと同じく、1件もattemptが無いchallengeIdは結果に含めない。
          return { results: results.filter((r) => r.attempt_count > 0) as T[], success: true, meta: {} }
        }
        throw new Error(`fake D1: unsupported all() query: ${query}`)
      },
    }
    return stmt
  }

  async function batch(statements: { run: () => Promise<unknown> }[]) {
    const out: unknown[] = []
    for (const statement of statements) out.push(await statement.run())
    return out
  }

  return {
    prepare,
    batch,
    _rows: rows,
    _attemptRows: attemptRows,
    _privateRooms: privateRooms,
    _privateRoomMemberships: privateRoomMemberships,
    _privateRoomInvites: privateRoomInvites,
    _friendships: friendships,
    _publicProfiles: publicProfiles,
    /** item 75-77: テストのセットアップ専用——SQL経由ではなく直接friendshipsへ入れる近道。 */
    _seedFriendship(a: string, b: string) {
      friendships.add(friendshipKey(a, b))
    },
    /** item 75-77: テストのセットアップ専用——getPublicProfileが何かを返すようにする近道。 */
    _seedPublicProfile(playerId: string, nickname: string) {
      publicProfiles.set(playerId, {
        nickname,
        avatar_json: JSON.stringify({ kind: 'preset', iconId: 'flame' }),
        equipped_title_id: null,
        has_dopa_pass: 0,
        best_dopa_percent: 0,
        endless_beginner_best: 0,
        endless_intermediate_best: 0,
        endless_advanced_best: 0,
        world_battle_wins: 0,
        achievement_count: 0,
        updated_at: Date.now(),
      })
    },
  }
}
