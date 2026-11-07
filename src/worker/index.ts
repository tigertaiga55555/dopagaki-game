import { createD1ChallengeAttemptRepository, createD1ChallengeRepository } from './challengeRepository'
import { isValidChallengeId, validateCreateChallengeAttemptInput, validateCreateChallengeInput } from './validation'
import type { ChallengeApiResult, ChallengeAttemptListResult, ChallengeAttemptRecord, ChallengeRecord } from '../challenge/types'

/** Ver.6 Phase 5.2: 無料ユーザー向けの履歴表示件数（DOPA PASS未実装のため、将来ここだけ変える想定）。 */
const FREE_TIER_ATTEMPT_LIMIT = 10
const MAX_ATTEMPT_LIMIT = 50

/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: このWorkerはCloudflare Previewの
 * 静的サイト配信に新しく追加する唯一のサーバーサイドロジック。wrangler.tomlの
 * `assets.run_worker_first = ["/api/*"]` により、`/api/*` 以外のすべてのパス
 * （既存のSPA本体一式）は従来どおり静的アセットが直接処理し、このWorkerには
 * 一切到達しない——つまりこのファイルにバグがあっても、ゲーム本体の表示・
 * プレイには何の影響も与えない（既存機能への回帰リスクをここで完全に遮断する）。
 *
 * 今回実装するのは最低目標である「Challengeを作成する／IDから取得する」の2エンドポイント
 * だけ（POST /api/challenges, GET /api/challenges/:id）。challenge_attempts（挑戦履歴）用の
 * エンドポイントは、スキーマ（migrations/）だけ用意してこのラウンドではまだ実装しない。
 *
 * env.CHALLENGE_DB（D1バインディング）が未設定の間は、すべてのエンドポイントが
 * 503 not_configured を返す。これは、このラウンドではまだ実際のD1データベースを
 * Cloudflareアカウント上に作成できていない（このサンドボックスにはCloudflare APIの
 * 認証情報が無く、wrangler d1 createを実行できない）ための暫定状態であり、仕様として
 * 意図したもの。database_idが用意されてwrangler.tomlに[[d1_databases]]を追加した
 * 瞬間、コードの変更なしにそのまま動作する。
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function errorResponse(result: Extract<ChallengeApiResult<never>, { ok: false }>): Response {
  const status = result.error === 'not_found' ? 404 : result.error === 'invalid_input' ? 400 : result.error === 'not_configured' ? 503 : 500
  return json({ ok: false, error: result.error, message: result.message } satisfies ChallengeApiResult<never>, status)
}

async function handleCreateChallenge(request: Request, db: D1Database): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return errorResponse({ ok: false, error: 'invalid_input', message: 'request body must be valid JSON' })
  }

  const validation = validateCreateChallengeInput(raw)
  if (!validation.ok || !validation.value) {
    return errorResponse({ ok: false, error: 'invalid_input', message: validation.message ?? 'invalid input' })
  }

  try {
    const repo = createD1ChallengeRepository(db)
    const id = crypto.randomUUID()
    const record = await repo.create(id, Date.now(), validation.value)
    return json({ ok: true, value: record } satisfies ChallengeApiResult<ChallengeRecord>, 201)
  } catch {
    return errorResponse({ ok: false, error: 'internal_error', message: 'failed to create challenge' })
  }
}

async function handleGetChallenge(id: string, db: D1Database): Promise<Response> {
  if (!isValidChallengeId(id)) {
    return errorResponse({ ok: false, error: 'invalid_input', message: 'invalid challenge id' })
  }

  try {
    const repo = createD1ChallengeRepository(db)
    const record = await repo.getById(id)
    if (!record) {
      return errorResponse({ ok: false, error: 'not_found', message: 'challenge not found' })
    }
    return json({ ok: true, value: record } satisfies ChallengeApiResult<ChallengeRecord>, 200)
  } catch {
    return errorResponse({ ok: false, error: 'internal_error', message: 'failed to fetch challenge' })
  }
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: POST /api/challenges/:id/attempts。
 * 勝敗（result）・挑戦回数（attemptNumber）はどちらもクライアントから受け取らず、
 * ここでChallengeレコードのcreatorScoreと突き合わせてサーバー側だけで確定させる
 * （クライアントが勝敗を自己申告できる余地を残さない）。
 */
async function handleCreateAttempt(request: Request, challengeId: string, db: D1Database): Promise<Response> {
  if (!isValidChallengeId(challengeId)) {
    return errorResponse({ ok: false, error: 'invalid_input', message: 'invalid challenge id' })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return errorResponse({ ok: false, error: 'invalid_input', message: 'request body must be valid JSON' })
  }

  const validation = validateCreateChallengeAttemptInput(raw, challengeId)
  if (!validation.ok || !validation.value) {
    return errorResponse({ ok: false, error: 'invalid_input', message: validation.message ?? 'invalid input' })
  }

  try {
    const challengeRepo = createD1ChallengeRepository(db)
    const challenge = await challengeRepo.getById(challengeId)
    if (!challenge) {
      return errorResponse({ ok: false, error: 'not_found', message: 'challenge not found' })
    }

    const attemptRepo = createD1ChallengeAttemptRepository(db)
    const input = validation.value
    // 作成者スコアを超えた→WIN、同点または下回った→LOSE（ユーザー指示どおりのシンプルな比較）。
    const result: 'win' | 'lose' = input.score > challenge.creatorScore ? 'win' : 'lose'
    const previousAttempts = await attemptRepo.countForPlayer(challengeId, input.playerId)
    const attemptNumber = previousAttempts + 1

    const record = await attemptRepo.create(crypto.randomUUID(), Date.now(), attemptNumber, result, input)
    return json({ ok: true, value: record } satisfies ChallengeApiResult<ChallengeAttemptRecord>, 201)
  } catch {
    return errorResponse({ ok: false, error: 'internal_error', message: 'failed to create attempt' })
  }
}

/**
 * GET /api/challenges/:id/attempts?playerId=...&limit=...
 * playerIdを渡すとその挑戦者自身の履歴だけ、省略すると（Challenge作成者向けの概観として）
 * 全挑戦者ぶんの最新行を返す。limitは常に無料ユーザー既定（10）〜上限（50）でクランプし、
 * DOPA PASS等の将来実装でもこのクランプ値を変えるだけで済むようにする。
 */
async function handleGetAttempts(request: Request, challengeId: string, db: D1Database): Promise<Response> {
  if (!isValidChallengeId(challengeId)) {
    return errorResponse({ ok: false, error: 'invalid_input', message: 'invalid challenge id' })
  }

  const url = new URL(request.url)
  const playerId = url.searchParams.get('playerId') ?? undefined
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_ATTEMPT_LIMIT) : FREE_TIER_ATTEMPT_LIMIT

  try {
    const challengeRepo = createD1ChallengeRepository(db)
    const challenge = await challengeRepo.getById(challengeId)
    if (!challenge) {
      return errorResponse({ ok: false, error: 'not_found', message: 'challenge not found' })
    }

    const attemptRepo = createD1ChallengeAttemptRepository(db)
    const { rows, totalCount } = await attemptRepo.list(challengeId, { playerId, limit })
    const value: ChallengeAttemptListResult = { attempts: rows, truncated: totalCount > rows.length }
    return json({ ok: true, value } satisfies ChallengeApiResult<ChallengeAttemptListResult>, 200)
  } catch {
    return errorResponse({ ok: false, error: 'internal_error', message: 'failed to fetch attempts' })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'not_found', message: 'unknown endpoint' } satisfies ChallengeApiResult<never>, 404)
    }

    if (!env.CHALLENGE_DB) {
      return errorResponse({ ok: false, error: 'not_configured', message: 'Challenge backend is not configured on this environment yet' })
    }

    if (url.pathname === '/api/challenges' && request.method === 'POST') {
      return handleCreateChallenge(request, env.CHALLENGE_DB)
    }

    const attemptsMatch = /^\/api\/challenges\/([^/]+)\/attempts$/.exec(url.pathname)
    if (attemptsMatch) {
      const challengeId = decodeURIComponent(attemptsMatch[1])
      if (request.method === 'POST') return handleCreateAttempt(request, challengeId, env.CHALLENGE_DB)
      if (request.method === 'GET') return handleGetAttempts(request, challengeId, env.CHALLENGE_DB)
    }

    const getMatch = /^\/api\/challenges\/([^/]+)$/.exec(url.pathname)
    if (getMatch && request.method === 'GET') {
      return handleGetChallenge(decodeURIComponent(getMatch[1]), env.CHALLENGE_DB)
    }

    return json({ ok: false, error: 'not_found', message: 'unknown endpoint' } satisfies ChallengeApiResult<never>, 404)
  },
}
