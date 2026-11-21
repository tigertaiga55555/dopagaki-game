import { isPrivateRoomClientMessage } from './privateRoomTypes'
import type { CreatePrivateRoomResponse, PrivateRoomClientMessage, PrivateRoomServerMessage, PrivateRoomStatusResponse } from './privateRoomTypes'
import type { BattleOpponentProfile } from './types'

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
