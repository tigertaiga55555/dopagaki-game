import { describe, expect, it } from 'vitest'
import { createD1ChallengeAttemptRepository, createD1ChallengeRepository } from './challengeRepository'
import { createFakeD1Database } from './testFakeD1'
import type { CreateChallengeAttemptInput, CreateChallengeInput } from '../challenge/types'

function sampleAttemptInput(overrides: Partial<CreateChallengeAttemptInput> = {}): CreateChallengeAttemptInput {
  return {
    challengeId: 'challenge-1',
    playerId: 'pid-challenger-1',
    nickname: '挑戦者太郎',
    avatar: { kind: 'preset', iconId: 'star' },
    equippedTitle: null,
    score: 350,
    ...overrides,
  }
}

function sampleInput(): CreateChallengeInput {
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
})

describe('createD1ChallengeAttemptRepository (Ver.6 Phase 5.2: challenge_attempts D1リポジトリ)', () => {
  it('countForPlayer: 挑戦前は0', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    expect(await repo.countForPlayer('challenge-1', 'pid-challenger-1')).toBe(0)
  })

  it('create: 挿入した内容がattemptNumber・resultとともにChallengeAttemptRecordとして返る', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    const record = await repo.create('attempt-1', 1700000001000, 1, 'lose', sampleAttemptInput())
    expect(record).toEqual({ id: 'attempt-1', createdAt: 1700000001000, attemptNumber: 1, result: 'lose', ...sampleAttemptInput() })
  })

  it('attemptNumber increment: 同一playerIdが同じchallengeへ複数回挑戦すると回数が正しく増える', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)

    const first = await repo.countForPlayer('challenge-1', 'pid-challenger-1')
    await repo.create('attempt-1', 1700000001000, first + 1, 'lose', sampleAttemptInput())

    const second = await repo.countForPlayer('challenge-1', 'pid-challenger-1')
    expect(second).toBe(1)
    await repo.create('attempt-2', 1700000002000, second + 1, 'lose', sampleAttemptInput())

    const third = await repo.countForPlayer('challenge-1', 'pid-challenger-1')
    expect(third).toBe(2)
    await repo.create('attempt-3', 1700000003000, third + 1, 'win', sampleAttemptInput({ score: 520 }))

    expect(await repo.countForPlayer('challenge-1', 'pid-challenger-1')).toBe(3)
  })

  it('同一ユーザー複数attempt: 別のplayerIdのattempt数には影響しない', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    await repo.create('attempt-1', 1700000001000, 1, 'lose', sampleAttemptInput({ playerId: 'pid-a' }))
    await repo.create('attempt-2', 1700000002000, 1, 'lose', sampleAttemptInput({ playerId: 'pid-b' }))
    expect(await repo.countForPlayer('challenge-1', 'pid-a')).toBe(1)
    expect(await repo.countForPlayer('challenge-1', 'pid-b')).toBe(1)
  })

  it('list: playerId指定時は新しい順でその挑戦者ぶんだけ返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    await repo.create('attempt-1', 1700000001000, 1, 'lose', sampleAttemptInput({ playerId: 'pid-a' }))
    await repo.create('attempt-2', 1700000002000, 1, 'lose', sampleAttemptInput({ playerId: 'pid-b' }))
    await repo.create('attempt-3', 1700000003000, 2, 'win', sampleAttemptInput({ playerId: 'pid-a', score: 520 }))

    const { rows, totalCount } = await repo.list('challenge-1', { playerId: 'pid-a', limit: 10 })
    expect(totalCount).toBe(2)
    expect(rows.map((r) => r.id)).toEqual(['attempt-3', 'attempt-1'])
  })

  it('list: playerId省略時は全挑戦者ぶんを新しい順で返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    await repo.create('attempt-1', 1700000001000, 1, 'lose', sampleAttemptInput({ playerId: 'pid-a' }))
    await repo.create('attempt-2', 1700000002000, 1, 'win', sampleAttemptInput({ playerId: 'pid-b', score: 600 }))

    const { rows, totalCount } = await repo.list('challenge-1', { limit: 10 })
    expect(totalCount).toBe(2)
    expect(rows.map((r) => r.id)).toEqual(['attempt-2', 'attempt-1'])
  })

  it('10件表示制限: limitを超えるattemptがあっても、limit件数＋truncated判定に使えるtotalCountを返す', async () => {
    const db = createFakeD1Database()
    const repo = createD1ChallengeAttemptRepository(db as never)
    for (let i = 0; i < 15; i++) {
      await repo.create(`attempt-${i}`, 1700000000000 + i * 1000, i + 1, 'lose', sampleAttemptInput({ playerId: 'pid-a' }))
    }
    const { rows, totalCount } = await repo.list('challenge-1', { playerId: 'pid-a', limit: 10 })
    expect(rows.length).toBe(10)
    expect(totalCount).toBe(15)
    // truncated判定（index.ts側のtotalCount > rows.length）が成立することを確認する。
    expect(totalCount > rows.length).toBe(true)
  })
})
