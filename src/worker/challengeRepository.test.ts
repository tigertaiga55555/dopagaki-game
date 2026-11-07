import { describe, expect, it } from 'vitest'
import { createD1ChallengeRepository } from './challengeRepository'
import { createFakeD1Database } from './testFakeD1'
import type { CreateChallengeInput } from '../challenge/types'

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
