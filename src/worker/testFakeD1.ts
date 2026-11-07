/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: テスト専用の最小限D1フェイク。
 *
 * 本物のD1 SQLパーサは実装せず、challengeRepository.tsが実際に発行する2種類の
 * クエリ（INSERT INTO challenges ... / SELECT * FROM challenges WHERE id = ?）だけを
 * 認識するごく単純なインメモリstoreとして振る舞う。D1Database自体はabstract classの
 * ため、テストではこのフェイクをD1Databaseとして直接castして使う
 * （Cloudflareの実D1を起動せずにWorkerのルーティング・リポジトリ層を検証するため）。
 */
export function createFakeD1Database() {
  const rows = new Map<string, Record<string, unknown>>()

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
        throw new Error(`fake D1: unsupported run() query: ${query}`)
      },
      async first<T>() {
        if (query.startsWith('SELECT * FROM challenges WHERE id = ?')) {
          const id = boundValues[0] as string
          return (rows.get(id) as T | undefined) ?? null
        }
        throw new Error(`fake D1: unsupported first() query: ${query}`)
      },
    }
    return stmt
  }

  return { prepare, _rows: rows }
}
