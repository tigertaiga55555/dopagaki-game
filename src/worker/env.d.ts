/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: Workerのbindings型。
 *
 * CHALLENGE_DBはoptional——wrangler.tomlにはまだ[[d1_databases]]ブロックを追加して
 * いない（実際のCloudflareアカウント上でのD1作成には認証情報が必要で、このセッションからは
 * 実行できないため。最終報告で詳細を説明する）。バインディングが存在しない現状でも、
 * Workerのfetchハンドラ（index.ts）がenv.CHALLENGE_DBの有無を必ずチェックし、未設定なら
 * 静的サイト配信には一切影響を与えずAPIだけが「not_configured」を返す設計にしてある。
 */
declare global {
  interface Env {
    CHALLENGE_DB?: D1Database
    /** Ver.6 Phase 6（1対1リアルタイム対戦）: 世界対戦の待機列を管理する単一のDurable Object。 */
    MATCHMAKER?: DurableObjectNamespace
    /** Ver.6 Phase 6: 1試合ぶんのリアルタイム状態を管理するDurable Object（世界対戦・フレンド対戦共通）。 */
    BATTLE_ROOM?: DurableObjectNamespace
  }
}

export {}
