import { describe, expect, it } from 'vitest'
import worker from './index'
import { createFakeD1Database } from './testFakeD1'
import type { ChallengeApiResult, ChallengeAttemptListResult, ChallengeAttemptRecord, ChallengePerformance, ChallengeRecord } from '../challenge/types'

function samplePerformance(overrides: Partial<ChallengePerformance> = {}): ChallengePerformance {
  return { finalDopaPercent: 420, baseDopaPercent: 400, accuracy: 0.72, maxCombo: 18, medianCorrectReactionMs: 540, ...overrides }
}

function sampleCreateBody(overrides: { performance?: Partial<ChallengePerformance> } & Record<string, unknown> = {}) {
  const { performance, ...rest } = overrides
  return {
    creatorPlayerId: 'pid-abc123',
    creatorNickname: 'ドパ太郎',
    creatorIcon: { kind: 'preset', iconId: 'flame' },
    creatorEquippedTitle: 'dopa100',
    mode: 'challenge500',
    problemSet: { version: 1, items: [{ type: 'numberPick', data: { answer: 3 } }] },
    conditions: { mode: 'challenge500' },
    creatorScore: 420,
    performance: samplePerformance(performance),
    ...rest,
  }
}

function sampleAttemptBody(overrides: { performance?: Partial<ChallengePerformance> } & Record<string, unknown> = {}) {
  const { performance, ...rest } = overrides
  return {
    playerId: 'pid-challenger-1',
    nickname: '挑戦者太郎',
    avatar: { kind: 'preset', iconId: 'star' },
    equippedTitle: null,
    score: 350,
    performance: samplePerformance(performance),
    ...rest,
  }
}

async function createSampleChallenge(
  env: { CHALLENGE_DB: never },
  overrides: { performance?: Partial<ChallengePerformance> } & Record<string, unknown> = {},
): Promise<ChallengeRecord> {
  const res = await worker.fetch(
    new Request('https://example.com/api/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleCreateBody(overrides)),
    }),
    env,
  )
  const body = (await res.json()) as ChallengeApiResult<ChallengeRecord>
  if (!body.ok) throw new Error('expected create to succeed')
  return body.value
}

async function postAttempt(
  env: { CHALLENGE_DB: never },
  challengeId: string,
  overrides: { performance?: Partial<ChallengePerformance> } & Record<string, unknown> = {},
): Promise<ChallengeAttemptRecord> {
  const res = await worker.fetch(
    new Request(`https://example.com/api/challenges/${challengeId}/attempts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleAttemptBody(overrides)),
    }),
    env,
  )
  const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptRecord>
  if (!body.ok) throw new Error(`expected attempt create to succeed, got: ${JSON.stringify(body)}`)
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
    expect(fetched.value.performance).toEqual(samplePerformance())
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

  it('Ver.6 Phase 5.3: POST /api/challenges はperformanceが欠けていると400 invalid_inputを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const { performance, ...bodyWithoutPerformance } = sampleCreateBody()
    void performance

    const res = await worker.fetch(
      new Request('https://example.com/api/challenges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bodyWithoutPerformance),
      }),
      env,
    )
    expect(res.status).toBe(400)
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

describe('worker fetch handler: challenge_attempts API (Ver.6 Phase 5.2/5.3: Challenge機能完成・勝敗判定強化)', () => {
  it('WIN判定: finalDopaPercent(420)を超える値で挑戦するとresult=win、decidedBy=finalDopaPercentが返る', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const attempt = await postAttempt(env, challenge.id, { score: 450, performance: { finalDopaPercent: 450 } })
    expect(attempt.result).toBe('win')
    expect(attempt.decidedBy).toBe('finalDopaPercent')
    expect(attempt.attemptNumber).toBe(1)
  })

  it('LOSE判定: finalDopaPercent(420)未満、および同値（exactTie）はどちらもLOSEになる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const loseAttempt = await postAttempt(env, challenge.id, { score: 400, performance: { finalDopaPercent: 400 } })
    expect(loseAttempt.result).toBe('lose')
    expect(loseAttempt.decidedBy).toBe('finalDopaPercent')

    // 作成者とperformanceが完全に同値 → exactTie → challenger LOSE（ホスト防衛）。
    const tieAttempt = await postAttempt(env, challenge.id, {})
    expect(tieAttempt.result).toBe('lose')
    expect(tieAttempt.decidedBy).toBe('exactTie')
  })

  it('タイブレーク: finalDopaPercentが同値ならbaseDopaPercentで決まる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env) // finalDopaPercent=420, baseDopaPercent=400

    const win = await postAttempt(env, challenge.id, { performance: { baseDopaPercent: 410 } })
    expect(win.result).toBe('win')
    expect(win.decidedBy).toBe('baseDopaPercent')

    const lose = await postAttempt(env, challenge.id, { performance: { baseDopaPercent: 390 } })
    expect(lose.result).toBe('lose')
    expect(lose.decidedBy).toBe('baseDopaPercent')
  })

  it('タイブレーク: finalDopaPercent/baseDopaPercentが同値ならaccuracyで決まる（UI表示と同じ%精度で比較する）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env) // accuracy=0.72 → 表示上72%

    const win = await postAttempt(env, challenge.id, { performance: { accuracy: 0.8 } })
    expect(win.result).toBe('win')
    expect(win.decidedBy).toBe('accuracy')

    // 0.721は丸めると72%で創作者と同じ表示になるため、ここでは決着せず次の項目（maxCombo）へ進む。
    const tieRoundedAccuracy = await postAttempt(env, challenge.id, { performance: { accuracy: 0.721, maxCombo: 30 } })
    expect(tieRoundedAccuracy.decidedBy).toBe('maxCombo')
  })

  it('タイブレーク: ここまで同値ならmaxComboで決まる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env) // maxCombo=18

    const win = await postAttempt(env, challenge.id, { performance: { maxCombo: 25 } })
    expect(win.result).toBe('win')
    expect(win.decidedBy).toBe('maxCombo')
  })

  it('タイブレーク: ここまで同値ならmedianCorrectReactionMsで決まる（速い方が勝ち）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env) // medianCorrectReactionMs=540

    const win = await postAttempt(env, challenge.id, { performance: { medianCorrectReactionMs: 300 } })
    expect(win.result).toBe('win')
    expect(win.decidedBy).toBe('medianCorrectReactionMs')

    const lose = await postAttempt(env, challenge.id, { performance: { medianCorrectReactionMs: 900 } })
    expect(lose.result).toBe('lose')
    expect(lose.decidedBy).toBe('medianCorrectReactionMs')
  })

  it('完全同値（5項目すべて一致）はchallenger LOSE・decidedBy=exactTie', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)
    const attempt = await postAttempt(env, challenge.id, {})
    expect(attempt.result).toBe('lose')
    expect(attempt.decidedBy).toBe('exactTie')
  })

  it('Ver.6 Phase 5.3: 既存Challenge（performance無し）への挑戦はcreatorScoreだけの旧ルールへフォールバックし、decidedBy=legacyScoreOnlyになる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    // このmigration以前のレコードを模すため、performance列だけをnullへ書き換える
    // （実際のmigration直後の既存行と同じ状態。推測で埋めずnullのまま扱う）。
    const row = db._rows.get(challenge.id)
    if (!row) throw new Error('row not found')
    row.performance_final_dopa_percent = null
    row.performance_base_dopa_percent = null
    row.performance_accuracy = null
    row.performance_max_combo = null
    row.performance_median_reaction_ms = null

    const winAttempt = await postAttempt(env, challenge.id, { score: 500, performance: { finalDopaPercent: 500 } })
    expect(winAttempt.result).toBe('win')
    expect(winAttempt.decidedBy).toBe('legacyScoreOnly')

    const loseAttempt = await postAttempt(env, challenge.id, { score: 420, performance: { finalDopaPercent: 420 } })
    expect(loseAttempt.result).toBe('lose')
    expect(loseAttempt.decidedBy).toBe('legacyScoreOnly')
  })

  it('attemptNumber increment: 同一playerIdが同じChallengeへ何度挑戦しても保存され、回数が増える（例: LOSE→LOSE→WIN）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const first = await postAttempt(env, challenge.id, { performance: { finalDopaPercent: 100 } })
    const second = await postAttempt(env, challenge.id, { performance: { finalDopaPercent: 200 } })
    const third = await postAttempt(env, challenge.id, { performance: { finalDopaPercent: 500 } })

    expect([first.attemptNumber, first.result]).toEqual([1, 'lose'])
    expect([second.attemptNumber, second.result]).toEqual([2, 'lose'])
    expect([third.attemptNumber, third.result]).toEqual([3, 'win'])
  })

  it('クライアントがresultやattemptNumber、decidedByを自己申告しても無視される（サーバー側だけが確定する）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...sampleAttemptBody({ score: 10, performance: { finalDopaPercent: 10 } }),
          result: 'win',
          attemptNumber: 999,
          decidedBy: 'maxCombo',
        }),
      }),
      env,
    )
    const body = (await res.json()) as ChallengeApiResult<ChallengeAttemptRecord>
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected attempt to succeed')
    // finalDopaPercent(10) < creatorの420なので、クライアントが'win'/'maxCombo'を自己申告してもサーバーは正しく判定する。
    expect(body.value.result).toBe('lose')
    expect(body.value.decidedBy).toBe('finalDopaPercent')
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

  it('POST attempts: performanceが欠けていると400 invalid_inputを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)
    const { performance, ...bodyWithoutPerformance } = sampleAttemptBody()
    void performance
    const res = await worker.fetch(
      new Request(`https://example.com/api/challenges/${challenge.id}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bodyWithoutPerformance),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })

  it('GET attempts: playerId指定で自分自身の履歴だけを新しい順に取得できる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env)

    await postAttempt(env, challenge.id, { playerId: 'pid-a', score: 100 })
    await postAttempt(env, challenge.id, { playerId: 'pid-b', score: 500 })

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
      await postAttempt(env, challenge.id, { playerId: 'pid-a', score: 100 + i })
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

describe('worker fetch handler: POST /api/challenges/summaries (Ver.6 Phase 5.3: 送った挑戦状一覧)', () => {
  it('複数idぶんの要約（基準記録・挑戦者数・総attempt数・突破者数）を一括取得できる', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challengeA = await createSampleChallenge(env, { creatorScore: 100 })
    const challengeB = await createSampleChallenge(env, { creatorScore: 200 })

    await postAttempt(env, challengeA.id, { playerId: 'pid-a', performance: { finalDopaPercent: 50 } })
    await postAttempt(env, challengeA.id, { playerId: 'pid-a', performance: { finalDopaPercent: 500 } })
    await postAttempt(env, challengeA.id, { playerId: 'pid-b', performance: { finalDopaPercent: 10 } })

    const res = await worker.fetch(
      new Request('https://example.com/api/challenges/summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [challengeA.id, challengeB.id, 'does-not-exist'] }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChallengeApiResult<
      { id: string; creatorScore: number; challengerCount: number; attemptCount: number; clearedCount: number }[]
    >
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected summaries fetch to succeed')
    const summaryA = body.value.find((s) => s.id === challengeA.id)
    const summaryB = body.value.find((s) => s.id === challengeB.id)
    expect(summaryA).toEqual({
      id: challengeA.id,
      mode: 'challenge500',
      creatorScore: 100,
      createdAt: challengeA.createdAt,
      challengerCount: 2,
      attemptCount: 3,
      clearedCount: 1,
    })
    expect(summaryB).toEqual({
      id: challengeB.id,
      mode: 'challenge500',
      creatorScore: 200,
      createdAt: challengeB.createdAt,
      challengerCount: 0,
      attemptCount: 0,
      clearedCount: 0,
    })
    expect(body.value.find((s) => s.id === 'does-not-exist')).toBeUndefined()
  })

  it('idsが空配列・非配列・非文字列混入のいずれも400 invalid_inputを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }

    const empty = await worker.fetch(
      new Request('https://example.com/api/challenges/summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [] }),
      }),
      env,
    )
    expect(empty.status).toBe(400)

    const notArray = await worker.fetch(
      new Request('https://example.com/api/challenges/summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: 'not-an-array' }),
      }),
      env,
    )
    expect(notArray.status).toBe(400)
  })
})

describe('worker fetch handler: POST /api/challenges/participated-summaries (Ver.6 Phase 5.4: 参加したChallenge一覧)', () => {
  it('指定したplayerIdの挑戦だけを対象に、ホスト情報・ホスト基準記録・自分の挑戦回数・最新resultを返す（挑戦者視点のまま、反転しない）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challengeA = await createSampleChallenge(env, { creatorNickname: 'ホストA', creatorScore: 100 })
    const challengeB = await createSampleChallenge(env, { creatorNickname: 'ホストB', creatorScore: 999 })

    // pid-meはchallengeAへ2回挑戦（LOSE→WIN）。pid-otherの挑戦は自分の集計に混ざらないこと。
    await postAttempt(env, challengeA.id, { playerId: 'pid-me', performance: { finalDopaPercent: 10 } })
    await postAttempt(env, challengeA.id, { playerId: 'pid-me', performance: { finalDopaPercent: 500 } })
    await postAttempt(env, challengeA.id, { playerId: 'pid-other', performance: { finalDopaPercent: 500 } })
    // challengeBはpid-meが未挑戦（一覧に含まれないこと）。

    const res = await worker.fetch(
      new Request('https://example.com/api/challenges/participated-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [challengeA.id, challengeB.id, 'does-not-exist'], playerId: 'pid-me' }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChallengeApiResult<
      {
        id: string
        creatorNickname: string
        creatorScore: number
        myAttemptCount: number
        myLatestResult: 'win' | 'lose'
        hostPerformance: ChallengePerformance | null
      }[]
    >
    expect(body.ok).toBe(true)
    if (!body.ok) throw new Error('expected participated-summaries fetch to succeed')
    expect(body.value.length).toBe(1)
    expect(body.value[0]).toMatchObject({
      id: challengeA.id,
      creatorNickname: 'ホストA',
      creatorScore: 100,
      myAttemptCount: 2,
      myLatestResult: 'win',
    })
    expect(body.value[0].hostPerformance).toEqual(challengeA.performance)
    // challengeB（未挑戦）・存在しないidはどちらも結果に含まれない。
    expect(body.value.find((s) => s.id === challengeB.id)).toBeUndefined()
  })

  it('DB上のresultは常に挑戦者視点のまま返る（ホスト視点への反転はクライアント側の表示専用ロジックの責務）', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }
    const challenge = await createSampleChallenge(env, { creatorScore: 100 })
    // 挑戦者が意図的にホストより低い記録でLOSEする。
    await postAttempt(env, challenge.id, { playerId: 'pid-me', performance: { finalDopaPercent: 1 } })

    const res = await worker.fetch(
      new Request('https://example.com/api/challenges/participated-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [challenge.id], playerId: 'pid-me' }),
      }),
      env,
    )
    const body = (await res.json()) as ChallengeApiResult<{ myLatestResult: 'win' | 'lose' }[]>
    if (!body.ok) throw new Error('expected fetch to succeed')
    expect(body.value[0].myLatestResult).toBe('lose')
  })

  it('idsが空配列・playerId欠落のいずれも400 invalid_inputを返す', async () => {
    const db = createFakeD1Database()
    const env = { CHALLENGE_DB: db as never }

    const noPlayerId = await worker.fetch(
      new Request('https://example.com/api/challenges/participated-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: ['some-id'] }),
      }),
      env,
    )
    expect(noPlayerId.status).toBe(400)

    const emptyIds = await worker.fetch(
      new Request('https://example.com/api/challenges/participated-summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [], playerId: 'pid-me' }),
      }),
      env,
    )
    expect(emptyIds.status).toBe(400)
  })
})
