/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: battleRepository.ts専用のテストフェイクD1。
 * 既存のtestFakeD1.ts（Challenge用）とはテーブルが別（battle_matches/player_battle_stats）
 * なため、クエリ照合の衝突を避けてここで独立させる。
 */
export function createBattleFakeD1Database() {
  const matches: Record<string, unknown>[] = []
  const stats = new Map<string, Record<string, unknown>>()

  function prepare(query: string) {
    let boundValues: unknown[] = []
    const stmt = {
      bind(...values: unknown[]) {
        boundValues = values
        return stmt
      },
      async run() {
        if (query.startsWith('INSERT INTO battle_matches')) {
          matches.push({ query, values: boundValues })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO player_battle_stats')) {
          const [playerId, wins, losses, draws, currentStreak, maxStreak, updatedAt] = boundValues
          stats.set(playerId as string, {
            player_id: playerId,
            wins,
            losses,
            draws,
            current_streak: currentStreak,
            max_streak: maxStreak,
            updated_at: updatedAt,
          })
          return { success: true, meta: {} }
        }
        throw new Error(`battle fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
        if (query.startsWith('SELECT * FROM player_battle_stats WHERE player_id = ?')) {
          const [playerId] = boundValues as [string]
          return (stats.get(playerId) as T | undefined) ?? null
        }
        throw new Error(`battle fake D1: unsupported first() query: ${query}`)
      },
    }
    return stmt
  }

  return { prepare, _matches: matches, _stats: stats }
}
