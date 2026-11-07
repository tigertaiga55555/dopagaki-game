import type { ChallengeApiResult, ChallengeDataSource, ChallengeRecord, CreateChallengeInput } from './types'

/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: Worker API（src/worker/index.ts）を
 * fetchで呼び出すクライアント側実装。将来の「挑戦状を送る」ボタン・受諾画面は、
 * このChallengeDataSourceインターフェースだけに依存させる想定（utils/
 * playerStatsRepository.tsと同じ「実装を差し替えてもUIを書き換えない」方針）。
 *
 * 今回のラウンドではこのクラス自体を呼び出すUIはまだ実装しない（ユーザー指示の
 * 今回の最低目標はWorker API側の作成・取得だけ）。将来、結果画面に「挑戦状を送る」
 * ボタンを追加する際にこのまま使えるよう、型・エラーハンドリングだけ先に用意する。
 */
async function parseJsonResponse<T>(response: Response): Promise<ChallengeApiResult<T>> {
  try {
    const body = (await response.json()) as ChallengeApiResult<T>
    return body
  } catch {
    return { ok: false, error: 'internal_error', message: 'invalid response from server' }
  }
}

export const remoteChallengeDataSource: ChallengeDataSource = {
  async createChallenge(input: CreateChallengeInput): Promise<ChallengeApiResult<ChallengeRecord>> {
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      return parseJsonResponse<ChallengeRecord>(response)
    } catch {
      return { ok: false, error: 'internal_error', message: 'network error while creating challenge' }
    }
  },

  async getChallenge(id: string): Promise<ChallengeApiResult<ChallengeRecord>> {
    try {
      const response = await fetch(`/api/challenges/${encodeURIComponent(id)}`)
      return parseJsonResponse<ChallengeRecord>(response)
    } catch {
      return { ok: false, error: 'internal_error', message: 'network error while fetching challenge' }
    }
  },
}
