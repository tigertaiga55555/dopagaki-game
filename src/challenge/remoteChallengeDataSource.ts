import type {
  ChallengeApiResult,
  ChallengeAttemptListResult,
  ChallengeAttemptRecord,
  ChallengeDataSource,
  ChallengeRecord,
  CreateChallengeAttemptInput,
  CreateChallengeInput,
} from './types'

/**
 * Ver.6 Phase 5.1/5.2（Challengeバックエンド基盤→機能完成）: Worker API
 * （src/worker/index.ts）をfetchで呼び出すクライアント側実装。結果画面の
 * 「挑戦状を送る」・Challenge受信画面・履歴画面は、このChallengeDataSourceインターフェース
 * だけに依存する（utils/playerStatsRepository.tsと同じ「実装を差し替えてもUIを
 * 書き換えない」方針）。
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

  async createAttempt(challengeId: string, input: CreateChallengeAttemptInput): Promise<ChallengeApiResult<ChallengeAttemptRecord>> {
    try {
      const response = await fetch(`/api/challenges/${encodeURIComponent(challengeId)}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      return parseJsonResponse<ChallengeAttemptRecord>(response)
    } catch {
      return { ok: false, error: 'internal_error', message: 'network error while creating attempt' }
    }
  },

  async getAttempts(
    challengeId: string,
    options?: { playerId?: string; limit?: number },
  ): Promise<ChallengeApiResult<ChallengeAttemptListResult>> {
    try {
      const params = new URLSearchParams()
      if (options?.playerId) params.set('playerId', options.playerId)
      if (options?.limit) params.set('limit', String(options.limit))
      const qs = params.toString()
      const response = await fetch(`/api/challenges/${encodeURIComponent(challengeId)}/attempts${qs ? `?${qs}` : ''}`)
      return parseJsonResponse<ChallengeAttemptListResult>(response)
    } catch {
      return { ok: false, error: 'internal_error', message: 'network error while fetching attempts' }
    }
  },
}
