/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: friendsRepository.ts専用のテストフェイクD1。
 * 既存のtestFakeD1.ts/battleTestFakeD1.tsと同じ方針（本物のSQLパーサは実装せず、
 * friendsRepository.tsが実際に発行する既知クエリだけを認識するインメモリstore）。
 *
 * db.batch()も使うため（respondToRequest/sendRequestByCodeの「承認+friendships挿入」を
 * 1回のbatchでまとめて実行する箇所）、トップレベルのbatch()メソッドも用意する——
 * テスト用途のため、本物のD1のような原子性（全成功/全失敗）は実装せず、単純に
 * 配列の各文を順番に実行するだけで十分。
 */
interface ProfileRow {
  player_id: string
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

interface FriendRequestRow {
  id: string
  from_player_id: string
  to_player_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  created_at: number
  responded_at: number | null
}

export function createFriendsFakeD1Database() {
  const profiles = new Map<string, ProfileRow>()
  const codesByPlayer = new Map<string, string>()
  const playerByCode = new Map<string, string>()
  const requests: FriendRequestRow[] = []
  const friendships = new Map<string, number>()

  function friendshipKey(a: string, b: string): string {
    return `${a}|${b}`
  }

  function prepare(query: string) {
    let boundValues: unknown[] = []
    const stmt = {
      bind(...values: unknown[]) {
        boundValues = values
        return stmt
      },
      async run() {
        if (query.startsWith('INSERT INTO player_public_profiles')) {
          const [
            playerId,
            nickname,
            avatarJson,
            equippedTitleId,
            hasDopaPass,
            bestDopaPercent,
            endlessBeginnerBest,
            endlessIntermediateBest,
            endlessAdvancedBest,
            worldBattleWins,
            achievementCount,
            updatedAt,
          ] = boundValues as [string, string, string, string | null, number, number, number, number, number, number, number, number]
          profiles.set(playerId, {
            player_id: playerId,
            nickname,
            avatar_json: avatarJson,
            equipped_title_id: equippedTitleId,
            has_dopa_pass: hasDopaPass,
            best_dopa_percent: bestDopaPercent,
            endless_beginner_best: endlessBeginnerBest,
            endless_intermediate_best: endlessIntermediateBest,
            endless_advanced_best: endlessAdvancedBest,
            world_battle_wins: worldBattleWins,
            achievement_count: achievementCount,
            updated_at: updatedAt,
          })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO friend_codes')) {
          const [playerId, code, _createdAt] = boundValues as [string, string, number]
          if (codesByPlayer.has(playerId) || playerByCode.has(code)) {
            throw new Error('UNIQUE constraint failed: friend_codes')
          }
          codesByPlayer.set(playerId, code)
          playerByCode.set(code, playerId)
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO friend_requests')) {
          const [id, fromPlayerId, toPlayerId, createdAt] = boundValues as [string, string, string, number]
          requests.push({ id, from_player_id: fromPlayerId, to_player_id: toPlayerId, status: 'pending', created_at: createdAt, responded_at: null })
          return { success: true, meta: {} }
        }
        if (query.startsWith('UPDATE friend_requests SET status = ')) {
          const isAccept = query.includes("'accepted'")
          const [respondedAt, id] = boundValues as [number, string]
          const row = requests.find((r) => r.id === id)
          if (row) {
            row.status = isAccept ? 'accepted' : 'rejected'
            row.responded_at = respondedAt
          }
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO friendships')) {
          const [a, b, createdAt] = boundValues as [string, string, number]
          const key = friendshipKey(a, b)
          if (!friendships.has(key)) friendships.set(key, createdAt)
          return { success: true, meta: {} }
        }
        throw new Error(`friends fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
        if (query.startsWith('SELECT * FROM player_public_profiles WHERE player_id = ?')) {
          const [playerId] = boundValues as [string]
          return (profiles.get(playerId) as T | undefined) ?? null
        }
        if (query.startsWith('SELECT code FROM friend_codes WHERE player_id = ?')) {
          const [playerId] = boundValues as [string]
          const code = codesByPlayer.get(playerId)
          return (code ? { code } : null) as T | null
        }
        if (query.startsWith('SELECT player_id FROM friend_codes WHERE code = ?')) {
          const [code] = boundValues as [string]
          const playerId = playerByCode.get(code)
          return (playerId ? { player_id: playerId } : null) as T | null
        }
        if (query.startsWith('SELECT 1 FROM friendships WHERE player_a_id = ? AND player_b_id = ?')) {
          const [a, b] = boundValues as [string, string]
          return (friendships.has(friendshipKey(a, b)) ? ({ '1': 1 } as unknown as T) : null)
        }
        if (query.startsWith('SELECT id FROM friend_requests WHERE from_player_id = ? AND to_player_id = ? AND status = ')) {
          const [fromPlayerId, toPlayerId] = boundValues as [string, string]
          const row = requests.find((r) => r.from_player_id === fromPlayerId && r.to_player_id === toPlayerId && r.status === 'pending')
          return (row ? { id: row.id } : null) as T | null
        }
        if (query.startsWith('SELECT from_player_id, to_player_id FROM friend_requests WHERE id = ?')) {
          const [id] = boundValues as [string]
          const row = requests.find((r) => r.id === id && r.status === 'pending')
          return (row ? { from_player_id: row.from_player_id, to_player_id: row.to_player_id } : null) as T | null
        }
        throw new Error(`friends fake D1: unsupported first() query: ${query}`)
      },
      async all<T>() {
        if (query.includes('FROM friend_requests r') && query.includes('LEFT JOIN player_public_profiles')) {
          const [playerId] = boundValues as [string]
          const pending = requests
            .filter((r) => r.to_player_id === playerId && r.status === 'pending')
            .sort((a, b) => b.created_at - a.created_at)
          const results = pending.map((r) => {
            const profile = profiles.get(r.from_player_id)
            return {
              request_id: r.id,
              from_player_id: r.from_player_id,
              created_at: r.created_at,
              ...(profile ?? { nickname: null }),
            }
          })
          return { results: results as T[], success: true, meta: {} }
        }
        if (query.startsWith('SELECT player_a_id, player_b_id, created_at FROM friendships')) {
          const [playerId] = boundValues as [string]
          const results: { player_a_id: string; player_b_id: string; created_at: number }[] = []
          for (const [key, createdAt] of friendships) {
            const [a, b] = key.split('|')
            if (a === playerId || b === playerId) results.push({ player_a_id: a, player_b_id: b, created_at: createdAt })
          }
          return { results: results as T[], success: true, meta: {} }
        }
        throw new Error(`friends fake D1: unsupported all() query: ${query}`)
      },
    }
    return stmt
  }

  async function batch(statements: { run: () => Promise<unknown> }[]) {
    const out: unknown[] = []
    for (const statement of statements) out.push(await statement.run())
    return out
  }

  return { prepare, batch, _profiles: profiles, _requests: requests, _friendships: friendships }
}
