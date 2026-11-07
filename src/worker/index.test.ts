import { describe, expect, it } from 'vitest'
import worker from './index'
import { createFakeD1Database } from './testFakeD1'
import type { ChallengeApiResult, ChallengeRecord } from '../challenge/types'

function sampleCreateBody() {
  return {
    creatorPlayerId: 'pid-abc123',
    creatorNickname: 'ドパ太郎',
    creatorIcon: { kind: 'preset', iconId: 'flame' },
    creatorEquippedTitle: 'dopa100',
    mode: 'challenge500',
    problemSet: { version: 1, items: [{ type: 'numberPick', data: { answer: 3 } }] },
    conditions: { mode: 'challenge500' },
    creatorScore: 420,
  }
}

describe('worker fetch handler (Ver.6 Phase 5.1: Challenge API routing)', () => {
  it('/api/* 以外のパスは404 JSON（通常は静的アセット側が処理するため、ここに来ること自体が想定外パス）', async () => {
    const res = await worker.fetch(new Request('https://example.com/'), {})
    expect(res.status).toBe(404)
  })

  it('CHALLENGE_DBが未設定の間は、/api/*がすべて503 not_configuredを返す（既存サイトには影響しない）', async () => {
    const res = await worker.fetch(new Request('https://example.com/api/challenges/some-id'), {})
    expect(res.status).toBe(503)
    const body = (await res.json()) as ChallengeApiResult<never>
    expect(body.ok).toBe(false)
    expect(!body.ok && body.error).toBe('not_configured')
  })

  it('POST /api/challenges → GET /api/challenges/:id で同じ内容が取得できる（クロスデバイス取得のコア要件）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }

    const createRes = await worker.fetch(
      new Request('https://example.com/api/challenges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleCreateBody()),
      }),
      env,
    )
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as ChallengeApiResult<ChallengeRecord>
    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error('expected create to succeed')
    const id = created.value.id
    expect(typeof id).toBe('string')

    // 別のfetch呼び出し（別デバイスからの取得を模す）。
    const getRes = await worker.fetch(new Request(`https://example.com/api/challenges/${id}`), env)
    expect(getRes.status).toBe(200)
    const fetched = (await getRes.json()) as ChallengeApiResult<ChallengeRecord>
    expect(fetched.ok).toBe(true)
    if (!fetched.ok) throw new Error('expected fetch to succeed')
    expect(fetched.value).toEqual(created.value)
  })

  it('POST /api/challenges に不正な入力を送ると400 invalid_inputを返し、D1へは書き込まれない', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }

    const res = await worker.fetch(
      new Request('https://example.com/api/challenges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bad: 'data' }),
      }),
      env,
    )
    expect(res.status).toBe(400)
    expect(db._rows.size).toBe(0)
  })

  it('GET /api/challenges/:id で存在しないIDは404 not_foundを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const res = await worker.fetch(new Request('https://example.com/api/challenges/does-not-exist'), env)
    expect(res.status).toBe(404)
  })

  it('GET /api/challenges/:id に不正な形式のIDを渡すと400を返す（SQLへ渡る前に拒否する）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const res = await worker.fetch(new Request(`https://example.com/api/challenges/${encodeURIComponent("1'; DROP TABLE challenges; --")}`), env)
    expect(res.status).toBe(400)
  })

  it('未定義のHTTPメソッドの組み合わせ（例: DELETE /api/challenges）は404を返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const res = await worker.fetch(new Request('https://example.com/api/challenges', { method: 'DELETE' }), env)
    expect(res.status).toBe(404)
  })
})
