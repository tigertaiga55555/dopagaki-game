/**
 * Ver.6 Phase 5.1/5.2（Challengeバックエンド基盤→機能完成）: テスト専用の最小限D1フェイク。
 *
 * 本物のD1 SQLパーサは実装せず、challengeRepository.tsが実際に発行するクエリ
 * （challenges / challenge_attemptsそれぞれのINSERT・SELECT）だけを認識するごく単純な
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
          })
          return { success: true, meta: {} }
        }
        if (query.startsWith('INSERT INTO challenge_attempts')) {
          const [id, challenge_id, player_id, nickname, icon_kind, icon_value, equipped_title, score, result, attempt_number, created_at] =
            boundValues
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
        throw new Error(`fake D1: unsupported all() query: ${query}`)
      },
    }
    return stmt
  }

  return { prepare, _rows: rows, _attemptRows: attemptRows }
}
