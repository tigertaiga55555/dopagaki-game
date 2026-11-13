/**
 * Ver.6 Phase 5.3（送った挑戦状一覧）: ログイン未実装の現段階では、自分が作成した
 * ChallengeのIDだけをlocalStorageへ保持する。Challenge情報本体（performance・
 * problemSet等）は一切保存せず、表示時は必ずサーバーAPI（POST /api/challenges/summaries・
 * GET /api/challenges/:id）から取得する——このキーはID一覧というインデックスに過ぎない。
 *
 * 将来ログイン実装後、Challenge作成者はcreatorPlayerIdで既にサーバーへ記録されている
 * ため、「creatorPlayerIdによるserver検索」へ移行する際もこのファイルの呼び出し元
 * （画面側）を変えずに、この中身だけをサーバー問い合わせへ差し替えられる
 * （utils/profileStorage.ts等と同じ「保存方式を画面から隠す」方針）。
 */
const CREATED_CHALLENGE_IDS_KEY = 'dopagaki:createdChallengeIdsV1'
/**
 * Ver.6 Phase 8: 無料ユーザーは直近5件のみ表示する確定仕様（将来DOPA PASSで無制限）に
 * 合わせ、10→5へ変更した。Challenge作成自体は無制限（D1側の行は一切削除しない）——
 * この定数はあくまで「ローカルでIDを何件まで覚えておくか」という表示件数の上限。
 */
const MAX_STORED_IDS = 5

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(CREATED_CHALLENGE_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** 新しい順（作成日時の降順）に並んだ、自分が作成したChallenge IDの一覧。最大10件。 */
export function getCreatedChallengeIds(): string[] {
  return readIds()
}

/** Challenge作成成功時に呼ぶ。既に同じidがあれば先頭へ移動するだけ（重複を増やさない）。 */
export function addCreatedChallengeId(id: string): void {
  try {
    const existing = readIds().filter((existingId) => existingId !== id)
    const next = [id, ...existing].slice(0, MAX_STORED_IDS)
    localStorage.setItem(CREATED_CHALLENGE_IDS_KEY, JSON.stringify(next))
  } catch {
    // 保存に失敗しても挑戦状の作成自体は既に成功しているため、ここでは何もしない
    // （次回「送った挑戦状」一覧にこの1件だけ載らない、という影響だけに留める）。
  }
}
