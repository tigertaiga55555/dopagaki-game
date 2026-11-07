import { createD1ChallengeRepository } from './challengeRepository'
import { isValidChallengeId, validateCreateChallengeInput } from './validation'
import type { ChallengeApiResult, ChallengeRecord } from '../challenge/types'

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

    const getMatch = /^\/api\/challenges\/([^/]+)$/.exec(url.pathname)
    if (getMatch && request.method === 'GET') {
      return handleGetChallenge(decodeURIComponent(getMatch[1]), env.CHALLENGE_DB)
    }

    return json({ ok: false, error: 'not_found', message: 'unknown endpoint' } satisfies ChallengeApiResult<never>, 404)
  },
}
