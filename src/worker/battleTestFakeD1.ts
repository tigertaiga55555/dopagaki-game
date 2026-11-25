/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: battleRepository.ts専用のテストフェイクD1。
 * 既存のtestFakeD1.ts（Challenge用）とはテーブルが別（battle_matches/player_battle_stats）
 * なため、クエリ照合の衝突を避けてここで独立させる。
 */
/** INSERT INTO battle_matchesの列順（battleRepository.tsのbind()呼び出しと完全に一致させる）。 */
const BATTLE_MATCH_COLUMNS = [
  'match_id',
  'mode',
  'player1_id',
  'player2_id',
  'player1_final_dopa_percent',
  'player1_base_dopa_percent',
  'player1_accuracy',
  'player1_max_combo',
  'player1_median_reaction_ms',
  'player2_final_dopa_percent',
  'player2_base_dopa_percent',
  'player2_accuracy',
  'player2_max_combo',
  'player2_median_reaction_ms',
  'winner',
  'decided_by',
  'started_at',
  'finished_at',
  'finish_reason',
] as const

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
          const row: Record<string, unknown> = {}
          BATTLE_MATCH_COLUMNS.forEach((col, i) => (row[col] = boundValues[i]))
          matches.push(row)
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
      async all<T>() {
        // battleRepository.ts getPerformanceAggregatesの固定クエリだけを対象にした簡易実装
        // （既存のtestFakeD1.ts/battleTestFakeD1.tsと同じ「既知クエリだけを模倣する」方針、
        // 汎用SQLエンジンではない）。
        if (query.includes('FROM battle_matches') && query.includes("mode = 'world'") && query.includes("finish_reason = 'completed'")) {
          const [playerId] = boundValues as [string]
          const results = matches
            .filter((m) => m.mode === 'world' && m.finish_reason === 'completed' && (m.player1_id === playerId || m.player2_id === playerId))
            .sort((a, b) => (b.finished_at as number) - (a.finished_at as number))
            .slice(0, 500)
          return { results: results as T[] }
        }
        throw new Error(`battle fake D1: unsupported all() query: ${query}`)
      },
    }
    return stmt
  }

  return { prepare, _matches: matches, _stats: stats }
}
