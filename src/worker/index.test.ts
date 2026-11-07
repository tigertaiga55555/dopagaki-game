import { describe, expect, it } from 'vitest'
import worker from './index'
import { createFakeD1Database } from './testFakeD1'
import type { ChallengeApiResult, ChallengeAttemptListResult, ChallengeAttemptRecord, ChallengeRecord } from '../challenge/types'

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

function sampleAttemptBody(overrides: Record<string, unknown> = {}) {
  return {
    playerId: 'pid-challenger-1',
    nickname: '挑戦者太郎',
    avatar: { kind: 'preset', iconId: 'star' },
    equippedTitle: null,
    score: 350,
    ...overrides,
  }
}

async function createSampleChallenge(env: { CHALLENGE_DB: never }): Promise<ChallengeRecord> {
  const res = await worker.fetch(
    new Request('https://example.com/api/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleCreateBody()),
    }),
    env,
  )
  const body = (await res.json()) as ChallengeApiResult<ChallengeRecord>
  if (!body.ok) throw new Error('expected create to succeed')
  return body.value
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

describe('worker fetch handler: challenge_attempts API (Ver.6 Phase 5.2: Challenge機能完成)', () => {
  it('WIN判定: creatorScore(420)を超えるscoreで挑戦するとresult=winが返る', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody({ score: 450 })),
      }),
      env,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptRecord>
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected attempt create to succeed')
    expect(body.value.result).toBe('win')
    expect(body.value.attemptNumber).toBe(1)
  })

  it('LOSE判定: creatorScore(420)以下のscoreで挑戦するとresult=loseが返る（同点もLOSE）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const loseRes = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody({ score: 400 })),
      }),
      env,
    )
    const loseBody = (await loseRes.json()) as ChallengeApiResult<ChallengeAttemptRecord>
    expect(loseBody.ok && loseBody.value.result).toBe('lose')

    const tieRes = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody({ score: 420 })),
      }),
      env,
    )
    const tieBody = (await tieRes.json()) as ChallengeApiResult<ChallengeAttemptRecord>
    expect(tieBody.ok && tieBody.value.result).toBe('lose')
  })

  it('attemptNumber increment: 同一playerIdが同じChallengeへ何度挑戦しても保存され、回数が増える（例: LOSE→LOSE→WIN）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    async function attempt(score: number) {
      const res = await worker.fetch(
        new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleAttemptBody({ score })),
        }),
        env,
      )
      const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptRecord>
      if (!body.ok) throw new Error('expected attempt to succeed')
      return body.value
    }

    const first = await attempt(300)
    const second = await attempt(350)
    const third = await attempt(500)

    expect([first.attemptNumber, first.result]).toEqual([1, 'lose'])
    expect([second.attemptNumber, second.result]).toEqual([2, 'lose'])
    expect([third.attemptNumber, third.result]).toEqual([3, 'win'])
  })

  it('クライアントがresultやattemptNumberを自己申告しても無視される（サーバー側だけが確定する）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...sampleAttemptBody({ score: 10 }), result: 'win', attemptNumber: 999 }),
      }),
      env,
    )
    const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptRecord>
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected attempt to succeed')
    // score(10) < creatorScore(420)なので、クライアントが'win'を自己申告してもサーバーは'lose'と判定する。
    expect(body.value.result).toBe('lose')
    expect(body.value.attemptNumber).toBe(1)
  })

  it('POST attempts: 存在しないChallengeIdには404 not_foundを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const res = await worker.fetch(
      new Request('https://example.com/api/challenges/does-not-exist/attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody()),
      }),
      env,
    )
    expect(res.status).toBe(404)
  })

  it('POST attempts: 不正な入力（avatar不正）は400 invalid_inputを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)
    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody({ avatar: { kind: 'preset', iconId: 'not-a-real-icon' } })),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })

  it('GET attempts: playerId指定で自分自身の履歴だけを新しい順に取得できる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody({ playerId: 'pid-a', score: 100 })),
      }),
      env,
    )
    await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleAttemptBody({ playerId: 'pid-b', score: 500 })),
      }),
      env,
    )

    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts?playerId=pid-a`, { method: 'GET' }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptListResult>
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected attempts fetch to succeed')
    expect(body.value.attempts).toHaveLength(1)
    expect(body.value.attempts[0].playerId).toBe('pid-a')
  })

  it('10件表示制限: limit未指定だと既定の10件までしか返らず、truncated=trueになる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    for (let i = 0; i < 15; i++) {
      await worker.fetch(
        new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleAttemptBody({ playerId: 'pid-a', score: 100 + i })),
        }),
        env,
      )
    }

    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts?playerId=pid-a`, { method: 'GET' }),
      env,
    )
    const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptListResult>
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected attempts fetch to succeed')
    expect(body.value.attempts).toHaveLength(10)
    expect(body.value.truncated).toBe(true)
  })

  it('GET attempts: 存在しないChallengeIdには404 not_foundを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const res = await worker.fetch(new Request('https://example.com/api/challenges/does-not-exist/attempts', { method: 'GET' }), env)
    expect(res.status).toBe(404)
  })
})
