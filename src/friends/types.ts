import type { AvatarRef, TitleId } from '../types'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: クライアント（friendsClient.ts）と
 * Worker（friendsRepository.ts・index.ts）の両方から参照する共有型定義。
 * battle/types.tsと同じ方針（型だけを共有し、実装は両側で分離する）。
 */

/** 他人から見える最小限の公開プロフィール。playerId自体はAPI応答に含めない（friendCodeの逆引きに使えてしまうため）。 */
export interface PublicProfileSnapshot {
  nickname: string
  avatar: AvatarRef
  equippedTitleId: TitleId | null
  hasDopaPass: boolean
  bestDopaPercent: number
  endlessBeginnerBest: number
  endlessIntermediateBest: number
  endlessAdvancedBest: number
  worldBattleWins: number
  achievementCount: number
  /** このスナップショットが記録された時刻（＝本人が最後にこれをアップロードした時刻）。 */
  updatedAt: number
}

export type FriendPresenceState = 'online' | 'playing' | 'offline'

export interface FriendSummary {
  playerId: string
  profile: PublicProfileSnapshot
  presence: FriendPresenceState
  friendSince: number
}

export interface IncomingFriendRequest {
  requestId: string
  fromPlayerId: string
  fromProfile: PublicProfileSnapshot
  createdAt: number
}

export type FriendCodeResponse = { ok: true; code: string } | { ok: false; reason: 'not_configured' }

export type SendFriendRequestResponse =
  | { ok: true; status: 'pending' | 'already_friends' }
  | { ok: false; reason: 'invalid_code' | 'self_request' | 'already_friends' | 'already_pending' | 'not_configured' }

export type RespondFriendRequestResponse = { ok: true } | { ok: false; reason: 'not_found' | 'not_configured' }

export interface UpsertPublicProfileBody {
  playerId: string
  profile: PublicProfileSnapshot
}

/** 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 48）: FriendProfileScreenの「フレンド申請」ボタン表示判断。 */
export type FriendRelationshipStatus = 'friends' | 'pending_outgoing' | 'pending_incoming' | 'none'
