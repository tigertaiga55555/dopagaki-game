import { describe, expect, it } from 'vitest'
import { createD1ChallengeAttemptRepository, createD1ChallengeRepository } from './challengeRepository'
import { createFakeD1Database } from './testFakeD1'
import type { ChallengePerformance, CreateChallengeAttemptInput, CreateChallengeInput } from '../challenge/types'

function samplePerformance(overrides: Partial<ChallengePerformance> = {}): ChallengePerformance {
  return {
    finalDopaPercent: 420,
    baseDopaPercent: 400,
    accuracy: 0.72,
    maxCombo: 18,
    medianCorrectReactionMs: 540,
    ...overrides,
  }
}

function sampleAttemptInput(overrides: Partial<CreateChallengeAttemptInput> = {}): CreateChallengeAttemptInput {
  return {
    challengeId: 'challenge-1',
    playerId: 'pid-challenger-1',
    nickname: '挑戦者太郎',
    avatar: { kind: 'preset', iconId: 'star' },
    equippedTitle: null,
    score: 350,
    performance: samplePerformance(),
    ...overrides,
  }
}

function sampleInput(overrides: Partial<CreateChallengeInput> = {}): CreateChallengeInput {
  return {
    creatorPlayerId: 'pid-abc123',
    creatorNickname: 'ドパ太郎',
    creatorIcon: { kind: 'preset', iconId: 'flame' },
    creatorEquippedTitle: 'dopa100',
    mode: 'challenge500',
    problemSet: { version: 1, items: [{ type: 'numberPick', data: { answer: 3 } }] },
    conditions: { mode: 'challenge500' },
    creatorScore: 420,
    performance: samplePerformance(),
    ...overrides,
  }
}

describe('createD1ChallengeRepository (Ver.6 Phase 5.1: Challenge D1リポジトリ)', () => {
  it('create: 挿入した内容がそのままChallengeRecordとして返る', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    const record = await repo.create('challenge-1', 1700000000000, sampleInput())
    expect(record).toEqual({ id: 'challenge-1', createdAt: 1700000000000, ...sampleInput() })
  })

  it('getById: createしたChallengeを別の呼び出しから同じ内容で取得できる（クロスデバイス取得のコア要件）', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    await repo.create('challenge-2', 1700000000001, sampleInput())

    // 新しいrepositoryインスタンス（別のリクエスト相当）から、同じdbハンドルで取得する。
    const repoFromAnotherRequest = createD1ChallengeRepository(db as never)
    const fetched = await repoFromAnotherRequest.getById('challenge-2')
    expect(fetched).toEqual({ id: 'challenge-2', createdAt: 1700000000001, ...sampleInput() })
  })

  it('getById: 存在しないIDはnullを返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    expect(await repo.getById('does-not-exist')).toBeNull()
  })

  it('remoteCustomアイコンも正しく保存・復元される', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    const input = { ...sampleInput(), creatorIcon: { kind: 'remoteCustom' as const, url: 'https://example.com/a.png' } }
    await repo.create('challenge-3', 1700000000002, input)
    const fetched = await repo.getById('challenge-3')
    expect(fetched?.creatorIcon).toEqual({ kind: 'remoteCustom', url: 'https://example.com/a.png' })
  })

  it('creatorEquippedTitle=nullも正しく保存・復元される', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    await repo.create('challenge-4', 1700000000003, { ...sampleInput(), creatorEquippedTitle: null })
    const fetched = await repo.getById('challenge-4')
    expect(fetched?.creatorEquippedTitle).toBeNull()
  })

  it('Ver.6 Phase 5.3: performanceの5項目が正しく保存・復元される（medianCorrectReactionMs=nullも含む)', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    await repo.create('challenge-5', 1700000000004, {
      ...sampleInput(),
      performance: samplePerformance({ medianCorrectReactionMs: null }),
    })
    const fetched = await repo.getById('challenge-5')
    expect(fetched?.performance).toEqual(samplePerformance({ medianCorrectReactionMs: null }))
  })

  it('Ver.6 Phase 5.3（送った挑戦状一覧）: getByIdsは複数idを1回でまとめて取得し、存在しないidは含めない', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    await repo.create('challenge-a', 1700000000000, sampleInput({ creatorScore: 100 }))
    await repo.create('challenge-b', 1700000000001, sampleInput({ creatorScore: 200 }))

    const results = await repo.getByIds(['challenge-a', 'does-not-exist', 'challenge-b'])
    expect(results.map((r) => r.id).sort()).toEqual(['challenge-a', 'challenge-b'])
  })

  it('getByIds: 空配列を渡すと空配列を返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    expect(await repo.getByIds([])).toEqual([])
  })

  it('Ver.6 Phase 8（ENDLESS Challenge）: mode=endless・performance=nullのChallengeを保存・復元できる', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeRepository(db as never)
    const input = sampleInput({
      mode: 'endless',
      conditions: { mode: 'endless', endlessDifficulty: 'advanced' },
      creatorScore: 37,
      performance: null,
    })
    await repo.create('challenge-endless-1', 1700000000000, input)
    const fetched = await repo.getById('challenge-endless-1')
    expect(fetched?.mode).toBe('endless')
    expect(fetched?.conditions).toEqual({ mode: 'endless', endlessDifficulty: 'advanced' })
    expect(fetched?.creatorScore).toBe(37)
    expect(fetched?.performance).toBeNull()
  })
})

describe('createD1ChallengeAttemptRepository (Ver.6 Phase 5.2/5.3: challenge_attempts D1リポジトリ)', () => {
  it('countForPlayer: 挑戦前は0', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    expect(await repo.countForPlayer('challenge-1', 'pid-challenger-1')).toBe(0)
  })

  it('create: 挿入した内容がattemptNumber・result・performance・decidedByとともにChallengeAttemptRecordとして返る', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    const record = await repo.create('attempt-1', 1700000001000, 1, 'lose', 'accuracy', sampleAttemptInput())
    expect(record).toEqual({
      id: 'attempt-1',
      createdAt: 1700000001000,
      attemptNumber: 1,
      result: 'lose',
      decidedBy: 'accuracy',
      ...sampleAttemptInput(),
    })
  })

  it('attemptNumber increment: 同一playerIdが同じchallengeへ複数回挑戦すると回数が正しく増える', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)

    const first = await repo.countForPlayer('challenge-1', 'pid-challenger-1')
    await repo.create('attempt-1', 1700000001000, first + 1, 'lose', 'finalDopaPercent', sampleAttemptInput())

    const second = await repo.countForPlayer('challenge-1', 'pid-challenger-1')
    expect(second).toBe(1)
    await repo.create('attempt-2', 1700000002000, second + 1, 'lose', 'finalDopaPercent', sampleAttemptInput())

    const third = await repo.countForPlayer('challenge-1', 'pid-challenger-1')
    expect(third).toBe(2)
    await repo.create('attempt-3', 1700000003000, third + 1, 'win', 'finalDopaPercent', sampleAttemptInput({ score: 520 }))

    expect(await repo.countForPlayer('challenge-1', 'pid-challenger-1')).toBe(3)
  })

  it('同一ユーザー複数attempt: 別のplayerIdのattempt数には影響しない', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    await repo.create('attempt-1', 1700000001000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-a' }))
    await repo.create('attempt-2', 1700000002000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-b' }))
    expect(await repo.countForPlayer('challenge-1', 'pid-a')).toBe(1)
    expect(await repo.countForPlayer('challenge-1', 'pid-b')).toBe(1)
  })

  it('list: playerId指定時は新しい順でその挑戦者ぶんだけ返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    await repo.create('attempt-1', 1700000001000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-a' }))
    await repo.create('attempt-2', 1700000002000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-b' }))
    await repo.create('attempt-3', 1700000003000, 2, 'win', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-a', score: 520 }))

    const { rows, totalCount } = await repo.list('challenge-1', { playerId: 'pid-a', limit: 10 })
    expect(totalCount).toBe(2)
    expect(rows.map((r) => r.id)).toEqual(['attempt-3', 'attempt-1'])
  })

  it('list: playerId省略時は全挑戦者ぶんを新しい順で返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    await repo.create('attempt-1', 1700000001000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-a' }))
    await repo.create('attempt-2', 1700000002000, 1, 'win', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-b', score: 600 }))

    const { rows, totalCount } = await repo.list('challenge-1', { limit: 10 })
    expect(totalCount).toBe(2)
    expect(rows.map((r) => r.id)).toEqual(['attempt-2', 'attempt-1'])
  })

  it('10件表示制限: limitを超えるattemptがあっても、limit件数＋truncated判定に使えるtotalCountを返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    for (let i = 0; i < 15; i++) {
      await repo.create(`attempt-${i}`, 1700000000000 + i * 1000, i + 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ playerId: 'pid-a' }))
    }
    const { rows, totalCount } = await repo.list('challenge-1', { playerId: 'pid-a', limit: 10 })
    expect(rows.length).toBe(10)
    expect(totalCount).toBe(15)
    // truncated判定（index.ts側のtotalCount > rows.length）が成立することを確認する。
    expect(totalCount > rows.length).toBe(true)
  })

  it('Ver.6 Phase 5.3（送った挑戦状一覧）: getAggregatesByChallengeIdsは挑戦者数・総attempt数・突破者数を一括集計する', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    // challenge-x: pid-a が LOSE→WIN、pid-b が LOSE の3 attempt、挑戦者2人、突破者1人。
    await repo.create('a1', 1700000001000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-a' }))
    await repo.create('a2', 1700000002000, 2, 'win', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-a' }))
    await repo.create('a3', 1700000003000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-b' }))
    // challenge-y: 挑戦者なし（0件のままaggregatesに含まれないことを確認する）。

    const aggregates = await repo.getAggregatesByChallengeIds(['challenge-x', 'challenge-y'])
    expect(aggregates['challenge-x']).toEqual({ challengerCount: 2, attemptCount: 3, clearedCount: 1 })
    expect(aggregates['challenge-y']).toBeUndefined()
  })

  it('getAggregatesByChallengeIds: 空配列を渡すと空オブジェクトを返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    expect(await repo.getAggregatesByChallengeIds([])).toEqual({})
  })

  it('Ver.6 Phase 5.4（参加したChallenge一覧）: getMyAggregatesByChallengeIdsは指定playerIdの挑戦回数・最新resultだけを一括取得する', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    // challenge-x: pid-me が LOSE→LOSE→WIN（3回挑戦、最新はWIN）。pid-other（別プレイヤー）の挑戦は無視されること。
    await repo.create('a1', 1700000001000, 1, 'lose', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-me' }))
    await repo.create('a2', 1700000002000, 2, 'lose', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-me' }))
    await repo.create('a3', 1700000003000, 3, 'win', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-me' }))
    await repo.create('a4', 1700000004000, 1, 'win', 'finalDopaPercent', sampleAttemptInput({ challengeId: 'challenge-x', playerId: 'pid-other' }))
    // challenge-y: pid-meが1回だけLOSE。
    await repo.create('a5', 1700000005000, 1, 'lose', 'accuracy', sampleAttemptInput({ challengeId: 'challenge-y', playerId: 'pid-me' }))
    // challenge-z: pid-meは未挑戦（結果に含まれないこと）。

    const aggregates = await repo.getMyAggregatesByChallengeIds(['challenge-x', 'challenge-y', 'challenge-z'], 'pid-me')
    expect(aggregates['challenge-x']).toEqual({ attemptCount: 3, latestResult: 'win' })
    expect(aggregates['challenge-y']).toEqual({ attemptCount: 1, latestResult: 'lose' })
    expect(aggregates['challenge-z']).toBeUndefined()
  })

  it('getMyAggregatesByChallengeIds: 空配列を渡すと空オブジェクトを返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    expect(await repo.getMyAggregatesByChallengeIds([], 'pid-me')).toEqual({})
  })

  it('Ver.6 Phase 8: result="draw"のattemptを保存・復元できる（通常Challengeの完全同値・ENDLESS Challengeの同STREAK数）', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    const record = await repo.create('attempt-draw-1', 1700000001000, 1, 'draw', 'exactTie', sampleAttemptInput())
    expect(record.result).toBe('draw')
    const { rows } = await repo.list('challenge-1', { limit: 10 })
    expect(rows[0].result).toBe('draw')
  })

  it('Ver.6 Phase 8（ENDLESS Challenge）: performance=null・score=STREAK数のattemptを保存・復元できる', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    const input = sampleAttemptInput({ score: 38, performance: null })
    const record = await repo.create('attempt-endless-1', 1700000001000, 1, 'win', 'streak', input)
    expect(record).toEqual({ id: 'attempt-endless-1', createdAt: 1700000001000, attemptNumber: 1, result: 'win', decidedBy: 'streak', ...input })
    const { rows } = await repo.list('challenge-1', { limit: 10 })
    expect(rows[0].performance).toBeNull()
    expect(rows[0].score).toBe(38)
  })
})
