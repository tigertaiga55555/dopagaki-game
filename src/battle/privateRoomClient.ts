import { isPrivateRoomClientMessage } from './privateRoomTypes'
import type { CreatePrivateRoomResponse, PrivateRoomClientMessage, PrivateRoomServerMessage, PrivateRoomStatusResponse } from './privateRoomTypes'
import type { BattleOpponentProfile } from './types'
import type { PublicProfileSnapshot } from '../friends/types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: battle/battleClient.tsと
 * 完全に同じ方針の薄いクライアント層（画面側はこのファイルの関数だけに依存する、
 * WebSocketのURL組み立て等を直接知らなくてよい）。ロビーWebSocketと実際の対戦
 * WebSocket（battleClient.ts、既存のまま一切変更しない）は完全に別の接続。
 */
export interface PrivateRoomSocket {
  send(message: PrivateRoomClientMessage): void
  close(): void
}

function wsOrigin(): string {
  return window.location.origin.replace(/^http/, 'ws')
}

export function connectToPrivateRoom(
  roomCode: string,
  playerId: string,
  profile: BattleOpponentProfile,
  onMessage: (msg: PrivateRoomServerMessage) => void,
  onClose: () => void,
): PrivateRoomSocket {
  const url = `${wsOrigin()}/api/rooms/private/${encodeURIComponent(roomCode)}/ws?playerId=${encodeURIComponent(playerId)}&profile=${encodeURIComponent(JSON.stringify(profile))}`
  const socket = new WebSocket(url)
  const pending: PrivateRoomClientMessage[] = []
  let isOpen = false
  socket.addEventListener('open', () => {
    isOpen = true
    for (const message of pending) socket.send(JSON.stringify(message))
    pending.length = 0
  })

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    let parsed: unknown
    try {
      parsed = JSON.parse(event.data)
    } catch {
      return
    }
    if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { type?: unknown }).type !== 'string') return
    onMessage(parsed as PrivateRoomServerMessage)
  })
  socket.addEventListener('close', onClose)

  return {
    send(message: PrivateRoomClientMessage) {
      if (!isPrivateRoomClientMessage(message)) return
      if (socket.readyState === WebSocket.CONNECTING) {
        pending.push(message)
        return
      }
      if (!isOpen || socket.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify(message))
    },
    close() {
      socket.close()
    },
  }
}

export async function createPrivateRoom(hostPlayerId: string, hostProfile: BattleOpponentProfile): Promise<CreatePrivateRoomResponse | null> {
  try {
    const res = await fetch('/api/rooms/private', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostPlayerId, hostProfile }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; value?: CreatePrivateRoomResponse }
    return body.ok ? (body.value ?? null) : null
  } catch {
    return null
  }
}

export async function getPrivateRoomStatus(roomCode: string): Promise<PrivateRoomStatusResponse> {
  try {
    const res = await fetch(`/api/rooms/private/${encodeURIComponent(roomCode)}`)
    return (await res.json()) as PrivateRoomStatusResponse
  } catch {
    return { ok: false, reason: 'not_found' }
  }
}

/** 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 31）: 招待ボタンの文言分岐（既存ルームあり/なし）に使う。 */
export async function getActiveRoomForHost(hostPlayerId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/rooms/private/active/${encodeURIComponent(hostPlayerId)}`)
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; roomCode?: string | null }
    return body.ok ? (body.roomCode ?? null) : null
  } catch {
    return null
  }
}

export interface ActiveRoomForPlayer {
  roomCode: string
  isHost: boolean
}

/**
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 46-47）: 「友達と対戦」を開いた瞬間、
 * ホーム画面（PrivateRoomHomeScreen.tsx）が「参加中/作成中のルームに戻る」を新規作成の
 * 案より優先して出すかどうかを判断するために使う。
 */
export async function getActiveRoomForPlayer(playerId: string): Promise<ActiveRoomForPlayer | null> {
  try {
    const res = await fetch(`/api/rooms/private/membership/${encodeURIComponent(playerId)}`)
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; roomCode: string | null; isHost: boolean }
    return body.ok && body.roomCode ? { roomCode: body.roomCode, isHost: body.isHost } : null
  } catch {
    return null
  }
}

export type SendRoomInviteReason = 'not_host' | 'not_friends' | 'already_member' | 'room_closed' | 'full' | 'self_invite' | 'not_configured'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 75-77）: ルームからのフレンド招待。
 * 実在の報告バグ（招待ボタンがオンライン状態だけで無効化され、オフラインの相手には
 * 一生招待できなかった）の修正——プレゼンス状態を一切見ない、サーバー権威の適格性判定
 * （ホスト本人・フレンド関係・未参加・定員未満・ルーム有効）をPOST /api/rooms/private/
 * :roomCode/invite側で行い、成功すれば必ずD1へ永続化する。戻り値のreasonをUIが
 * そのまま文言分岐に使える。
 */
export async function sendRoomInvite(roomCode: string, fromPlayerId: string, toPlayerId: string): Promise<{ ok: boolean; reason?: SendRoomInviteReason }> {
  try {
    const res = await fetch(`/api/rooms/private/${encodeURIComponent(roomCode)}/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromPlayerId, toPlayerId }),
    })
    const body = (await res.json()) as { ok: boolean; reason?: SendRoomInviteReason }
    return body
  } catch {
    return { ok: false, reason: 'not_configured' }
  }
}

/** item 75-77: ロビーの招待モーダルが「招待済み」状態を出すために使う。 */
export async function getOutgoingRoomInvites(roomCode: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/rooms/private/${encodeURIComponent(roomCode)}/invites/outgoing`)
    if (!res.ok) return []
    const body = (await res.json()) as { ok: boolean; toPlayerIds?: string[] }
    return body.ok ? (body.toPlayerIds ?? []) : []
  } catch {
    return []
  }
}

export interface IncomingRoomInvite {
  roomCode: string
  fromProfile: PublicProfileSnapshot
  createdAt: number
}

/** item 75-77: FRIENDS画面を開いた時／アプリ起動時に、オフライン中に届いていた招待も含めて必ず拾う。 */
export async function listIncomingRoomInvites(playerId: string): Promise<IncomingRoomInvite[]> {
  try {
    const res = await fetch(`/api/rooms/private/invites/incoming?playerId=${encodeURIComponent(playerId)}`)
    if (!res.ok) return []
    const body = (await res.json()) as { ok: boolean; value?: IncomingRoomInvite[] }
    return body.ok ? (body.value ?? []) : []
  } catch {
    return []
  }
}
