/**
 * Ver.6 Phase 5.4（実機QA最終修正）: ログイン未実装の現段階では、自分が挑戦した
 * ChallengeのIDだけをlocalStorageへ保持する。createdChallengesStorage.tsと対になる
 * 構造（Challenge本体・attempt情報は二重保存せず、表示時は必ずサーバーAPIから取得する）。
 *
 * 将来ログイン実装後は「challengerPlayerIdによるサーバー検索」へ移行する想定のため、
 * 画面側はこのファイルの関数だけに依存させる（utils/createdChallengesStorage.tsと同じ
 * 「保存方式を画面から隠す」方針）。
 */
const PARTICIPATED_CHALLENGE_IDS_KEY = 'dopagaki:participatedChallengeIdsV1'
/** 無料ユーザーは直近10件のみ表示する既存方針に合わせ、保持件数自体もここで揃える。 */
const MAX_STORED_IDS = 10

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(PARTICIPATED_CHALLENGE_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** 新しい順（参加日時の降順）に並んだ、自分が参加したChallenge IDの一覧。最大10件。 */
export function getParticipatedChallengeIds(): string[] {
  return readIds()
}

/**
 * Challenge参加成功時（最初のattempt保存成功時）に呼ぶ。既に同じidがあれば先頭へ
 * 移動するだけ（重複を増やさない）。
 */
export function addParticipatedChallengeId(id: string): void {
  try {
    const existing = readIds().filter((existingId) => existingId !== id)
    const next = [id, ...existing].slice(0, MAX_STORED_IDS)
    localStorage.setItem(PARTICIPATED_CHALLENGE_IDS_KEY, JSON.stringify(next))
  } catch {
    // 保存に失敗しても挑戦自体は既に成功しているため、ここでは何もしない
    // （次回「参加したChallenge」一覧にこの1件だけ載らない、という影響だけに留める）。
  }
}
