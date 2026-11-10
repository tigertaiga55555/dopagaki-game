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
        throw new Error(`fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
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
            return {
              challenge_id: challengeId,
              challenger_count: challengerCount,
              attempt_count: rowsForChallenge.length,
              cleared_count: clearedPlayers.size,
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

  return { prepare, _rows: rows, _attemptRows: attemptRows }
}
