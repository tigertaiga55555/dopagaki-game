import { describe, expect, it } from 'vitest'
import { buildFriendSummaries, createD1FriendsRepository } from './friendsRepository'
import { createFriendsFakeD1Database } from './friendsTestFakeD1'
import type { PublicProfileSnapshot } from '../friends/types'

function fakeProfile(nickname: string): PublicProfileSnapshot {
  return {
    nickname,
    avatar: { kind: 'preset', iconId: 'star' },
    equippedTitleId: null,
    hasDopaPass: false,
    bestDopaPercent: 100,
    endlessBeginnerBest: 10,
    endlessIntermediateBest: 5,
    endlessAdvancedBest: 0,
    worldBattleWins: 3,
    achievementCount: 7,
    updatedAt: 1000,
  }
}

describe('friendsRepository (次フェーズ: FRIENDS/ナビ刷新ラウンド item 27)', () => {
  it('getOrCreateFriendCode: 同じplayerIdには常に同じコードを返す', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const first = await repo.getOrCreateFriendCode('p1', 1000)
    const second = await repo.getOrCreateFriendCode('p1', 2000)
    expect(first).toBe(second)
    expect(first).toHaveLength(6)
  })

  it('sendRequestByCode: 存在しないコードはinvalid_code', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const result = await repo.sendRequestByCode('p1', 'ZZZZZZ', 1000)
    expect(result).toEqual({ status: 'rejected', reason: 'invalid_code' })
  })

  it('sendRequestByCode: 自分のコードへの申請はself_request', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const code = await repo.getOrCreateFriendCode('p1', 1000)
    const result = await repo.sendRequestByCode('p1', code, 1000)
    expect(result).toEqual({ status: 'rejected', reason: 'self_request' })
  })

  it('申請→承認で友達になり、重複申請はガードされる', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const codeB = await repo.getOrCreateFriendCode('p2', 1000)

    const first = await repo.sendRequestByCode('p1', codeB, 1000)
    expect(first).toEqual({ status: 'pending' })

    const duplicate = await repo.sendRequestByCode('p1', codeB, 1100)
    expect(duplicate).toEqual({ status: 'rejected', reason: 'already_pending' })

    const incoming = await repo.listIncomingRequests('p2')
    expect(incoming).toHaveLength(0) // p1がまだpublic profileをアップロードしていないため、公開プロフィールが無い申請者は一覧に出ない

    await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
    const incomingAfterProfile = await repo.listIncomingRequests('p2')
    expect(incomingAfterProfile).toHaveLength(1)
    expect(incomingAfterProfile[0].fromPlayerId).toBe('p1')
    expect(incomingAfterProfile[0].fromProfile.nickname).toBe('Alice')

    const respond = await repo.respondToRequest(incomingAfterProfile[0].requestId, 'p2', 'accept', 2000)
    expect(respond).toEqual({ ok: true })

    expect(await repo.areFriends('p1', 'p2')).toBe(true)
    expect(await repo.areFriends('p2', 'p1')).toBe(true)

    const friendsOfP2 = await repo.listFriends('p2')
    expect(friendsOfP2).toEqual([{ playerId: 'p1', friendSince: 2000 }])
  })

  it('既に友達同士はsendRequestByCodeがalready_friendsを返す', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const codeB = await repo.getOrCreateFriendCode('p2', 1000)
    await repo.sendRequestByCode('p1', codeB, 1000)
    const incoming = await repo.listIncomingRequests('p2')
    // 公開プロフィールが無くてもrespondToRequest自体は動く（一覧表示だけが公開プロフィール依存）。
    // 一覧に出すためp1のプロフィールを用意してから申請IDを再取得する。
    await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
    const incomingAfterProfile = await repo.listIncomingRequests('p2')
    await repo.respondToRequest(incomingAfterProfile[0]?.requestId ?? incoming[0]?.requestId ?? '', 'p2', 'accept', 2000)

    const again = await repo.sendRequestByCode('p1', codeB, 3000)
    expect(again).toEqual({ status: 'already_friends' })
  })

  it('相手からの未処理申請が既にある場合、送ると即座に友達になる', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const codeA = await repo.getOrCreateFriendCode('p1', 1000)
    const codeB = await repo.getOrCreateFriendCode('p2', 1000)

    await repo.sendRequestByCode('p1', codeB, 1000) // p1 -> p2 (pending)
    const result = await repo.sendRequestByCode('p2', codeA, 2000) // p2 -> p1 (reverse pending exists)
    expect(result).toEqual({ status: 'already_friends' })
    expect(await repo.areFriends('p1', 'p2')).toBe(true)
  })

  it('respondToRequest: reject後は友達にならない', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const codeB = await repo.getOrCreateFriendCode('p2', 1000)
    await repo.sendRequestByCode('p1', codeB, 1000)
    await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
    const incoming = await repo.listIncomingRequests('p2')
    await repo.respondToRequest(incoming[0].requestId, 'p2', 'reject', 2000)
    expect(await repo.areFriends('p1', 'p2')).toBe(false)
  })

  it('respondToRequest: 本人以外(to_player_idが一致しない)が応答しようとするとnot_found', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const codeB = await repo.getOrCreateFriendCode('p2', 1000)
    await repo.sendRequestByCode('p1', codeB, 1000)
    await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
    const incoming = await repo.listIncomingRequests('p2')
    const result = await repo.respondToRequest(incoming[0].requestId, 'p3', 'accept', 2000)
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('upsertPublicProfile/getPublicProfile: 保存した内容がそのまま読み取れる', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const profile = fakeProfile('Bob')
    await repo.upsertPublicProfile('p1', profile)
    const read = await repo.getPublicProfile('p1')
    expect(read).toEqual(profile)
  })

  it('getPublicProfile: 未アップロードのplayerIdはnull', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    expect(await repo.getPublicProfile('nobody')).toBeNull()
  })

  it('buildFriendSummaries: 友達ごとの公開プロフィールを組み立てる', async () => {
    const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
    const codeB = await repo.getOrCreateFriendCode('p2', 1000)
    await repo.sendRequestByCode('p1', codeB, 1000)
    await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
    const incoming = await repo.listIncomingRequests('p2')
    await repo.respondToRequest(incoming[0].requestId, 'p2', 'accept', 2000)
    await repo.upsertPublicProfile('p2', fakeProfile('Bob'))

    const summaries = await buildFriendSummaries(repo, 'p1')
    expect(summaries).toEqual([{ playerId: 'p2', profile: fakeProfile('Bob'), friendSince: 2000 }])
  })

  describe('getRelationshipStatus (item 48)', () => {
    it('何の関係もなければnone', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      expect(await repo.getRelationshipStatus('p1', 'p2')).toBe('none')
    })

    it('既に友達ならfriends（どちらの視点でも）', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      const codeB = await repo.getOrCreateFriendCode('p2', 1000)
      await repo.sendRequestByCode('p1', codeB, 1000)
      await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
      const incoming = await repo.listIncomingRequests('p2')
      await repo.respondToRequest(incoming[0].requestId, 'p2', 'accept', 2000)
      expect(await repo.getRelationshipStatus('p1', 'p2')).toBe('friends')
      expect(await repo.getRelationshipStatus('p2', 'p1')).toBe('friends')
    })

    it('自分が送った未処理の申請はpending_outgoing、相手から見るとpending_incoming', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      const codeB = await repo.getOrCreateFriendCode('p2', 1000)
      await repo.sendRequestByCode('p1', codeB, 1000)
      expect(await repo.getRelationshipStatus('p1', 'p2')).toBe('pending_outgoing')
      expect(await repo.getRelationshipStatus('p2', 'p1')).toBe('pending_incoming')
    })
  })

  describe('removeFriend（ゲーム機能クローズラウンド、item 80）', () => {
    it('フレンド解除後、areFriendsはfalseを返す（どちらの引数順でも）', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
      const codeB = await repo.getOrCreateFriendCode('p2', 1000)
      await repo.sendRequestByCode('p1', codeB, 1000)
      const incoming = await repo.listIncomingRequests('p2')
      await repo.respondToRequest(incoming[0].requestId, 'p2', 'accept', 2000)
      expect(await repo.areFriends('p1', 'p2')).toBe(true)

      await repo.removeFriend('p1', 'p2')
      expect(await repo.areFriends('p1', 'p2')).toBe(false)
      expect(await repo.areFriends('p2', 'p1')).toBe(false)
    })

    it('フレンド解除後、getRelationshipStatusはnoneになる', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
      const codeB = await repo.getOrCreateFriendCode('p2', 1000)
      await repo.sendRequestByCode('p1', codeB, 1000)
      const incoming = await repo.listIncomingRequests('p2')
      await repo.respondToRequest(incoming[0].requestId, 'p2', 'accept', 2000)

      await repo.removeFriend('p2', 'p1')
      expect(await repo.getRelationshipStatus('p1', 'p2')).toBe('none')
      expect(await repo.getRelationshipStatus('p2', 'p1')).toBe('none')
    })

    it('フレンド解除後、どちらからでも新しいフレンド申請を送り直せる', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      await repo.upsertPublicProfile('p1', fakeProfile('Alice'))
      const codeB = await repo.getOrCreateFriendCode('p2', 1000)
      await repo.sendRequestByCode('p1', codeB, 1000)
      const incoming = await repo.listIncomingRequests('p2')
      await repo.respondToRequest(incoming[0].requestId, 'p2', 'accept', 2000)
      await repo.removeFriend('p1', 'p2')

      const codeA = await repo.getOrCreateFriendCode('p1', 1000)
      const result = await repo.sendRequestByCode('p2', codeA, 3000)
      expect(result).toEqual({ status: 'pending' })
    })

    it('存在しないフレンド関係をremoveFriendしても何も起きない（冪等）', async () => {
      const repo = createD1FriendsRepository(createFriendsFakeD1Database() as never)
      await expect(repo.removeFriend('p1', 'p2')).resolves.toBeUndefined()
    })
  })
})
