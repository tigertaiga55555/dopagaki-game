import type {
  FriendCodeResponse,
  FriendRelationshipStatus,
  FriendSummary,
  IncomingFriendRequest,
  PublicProfileSnapshot,
  RespondFriendRequestResponse,
  SendFriendRequestResponse,
} from './types'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: battle/battleClient.tsと同じ方針
 * （画面はこのファイルの関数だけに依存する）。FRIENDS機能自体はREST（友達関係の
 * 変更は頻度が低く、WebSocketで押し続ける必要がない）、プレゼンスだけが別途
 * presence/presenceClient.tsのWebSocketを使う。
 */
export async function getOrCreateFriendCode(playerId: string): Promise<FriendCodeResponse> {
  try {
    const res = await fetch('/api/friends/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId }),
    })
    return (await res.json()) as FriendCodeResponse
  } catch {
    return { ok: false, reason: 'not_configured' }
  }
}

export async function sendFriendRequest(fromPlayerId: string, toCode: string): Promise<SendFriendRequestResponse> {
  try {
    const res = await fetch('/api/friends/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromPlayerId, toCode }),
    })
    return (await res.json()) as SendFriendRequestResponse
  } catch {
    return { ok: false, reason: 'not_configured' }
  }
}

/** 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 48）: ロビーのメンバーカード→プロフィールから、既に知っているplayerIdへ直接送る。 */
export async function sendFriendRequestByPlayerId(fromPlayerId: string, toPlayerId: string): Promise<SendFriendRequestResponse> {
  try {
    const res = await fetch('/api/friends/requests/by-player-id', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromPlayerId, toPlayerId }),
    })
    return (await res.json()) as SendFriendRequestResponse
  } catch {
    return { ok: false, reason: 'not_configured' }
  }
}

export async function listIncomingFriendRequests(playerId: string): Promise<IncomingFriendRequest[]> {
  try {
    const res = await fetch(`/api/friends/requests/incoming?playerId=${encodeURIComponent(playerId)}`)
    if (!res.ok) return []
    const body = (await res.json()) as { ok: boolean; value?: IncomingFriendRequest[] }
    return body.ok ? (body.value ?? []) : []
  } catch {
    return []
  }
}

export async function respondToFriendRequest(
  requestId: string,
  playerId: string,
  action: 'accept' | 'reject',
): Promise<RespondFriendRequestResponse> {
  try {
    const res = await fetch(`/api/friends/requests/${encodeURIComponent(requestId)}/respond`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId, action }),
    })
    return (await res.json()) as RespondFriendRequestResponse
  } catch {
    return { ok: false, reason: 'not_configured' }
  }
}

export async function listFriends(playerId: string): Promise<FriendSummary[]> {
  try {
    const res = await fetch(`/api/friends?playerId=${encodeURIComponent(playerId)}`)
    if (!res.ok) return []
    const body = (await res.json()) as { ok: boolean; value?: FriendSummary[] }
    return body.ok ? (body.value ?? []) : []
  } catch {
    return []
  }
}

export async function getFriendPublicProfile(playerId: string): Promise<PublicProfileSnapshot | null> {
  try {
    const res = await fetch(`/api/players/${encodeURIComponent(playerId)}/profile`)
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; value?: PublicProfileSnapshot }
    return body.ok ? (body.value ?? null) : null
  } catch {
    return null
  }
}

/** 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 48）: FriendProfileScreenの「フレンド申請」ボタン表示判断。 */
export async function getFriendRelationshipStatus(viewerId: string, targetId: string): Promise<FriendRelationshipStatus> {
  try {
    const res = await fetch(`/api/friends/relationship?viewerId=${encodeURIComponent(viewerId)}&targetId=${encodeURIComponent(targetId)}`)
    if (!res.ok) return 'none'
    const body = (await res.json()) as { ok: boolean; status?: FriendRelationshipStatus }
    return body.ok ? (body.status ?? 'none') : 'none'
  } catch {
    return 'none'
  }
}

export async function upsertPublicProfile(playerId: string, profile: PublicProfileSnapshot): Promise<boolean> {
  try {
    const res = await fetch(`/api/players/${encodeURIComponent(playerId)}/profile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
    return res.ok
  } catch {
    return false
  }
}
