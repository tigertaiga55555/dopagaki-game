import { isBattleClientMessage } from './types'
import type { BattleClientMessage, BattleOpponentProfile, BattleServerMessage, CreateRoomResponse, RoomStatusResponse } from './types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: Worker（Durable Object）への接続をまとめた
 * 薄いクライアント層。remoteChallengeDataSource.tsと同じ「画面はこのファイルの関数だけに
 * 依存する」方針（画面側がWebSocketのURL組み立て等を直接知らなくてよい）。
 */
export interface BattleSocket {
  send(message: BattleClientMessage): void
  close(): void
}

function wsOrigin(): string {
  return window.location.origin.replace(/^http/, 'ws')
}

function buildProfileQuery(profile: BattleOpponentProfile): string {
  return `profile=${encodeURIComponent(JSON.stringify(profile))}`
}

function connect(
  path: string,
  playerId: string,
  profile: BattleOpponentProfile,
  onMessage: (msg: BattleServerMessage) => void,
  onClose: () => void,
): BattleSocket {
  const url = `${wsOrigin()}${path}?playerId=${encodeURIComponent(playerId)}&${buildProfileQuery(profile)}`
  const socket = new WebSocket(url)
  // 接続直後（readyState===CONNECTING）に呼ばれたsend()を黒子で溜めておき、
  // open イベントで初めてまとめて送る。これをしないと、画面側が接続直後に
  // 同期的に呼ぶ送信（例: 世界対戦のready自動送信）が無言で消え、相手が
  // 永久にqueue_joined/match_startを受け取れなくなる。
  const pending: BattleClientMessage[] = []
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
    // サーバーからのメッセージも、クライアント→サーバーと同じ最低限の形チェックを通す
    // （任意JSONをそのまま信用しない方針を両方向で徹底する）。
    if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { type?: unknown }).type !== 'string') return
    onMessage(parsed as BattleServerMessage)
  })
  socket.addEventListener('close', onClose)

  return {
    send(message: BattleClientMessage) {
      if (!isBattleClientMessage(message)) return
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

export function connectToWorldQueue(
  playerId: string,
  profile: BattleOpponentProfile,
  onMessage: (msg: BattleServerMessage) => void,
  onClose: () => void,
): BattleSocket {
  return connect('/api/battles/queue/ws', playerId, profile, onMessage, onClose)
}

export function connectToBattleRoom(
  matchId: string,
  playerId: string,
  profile: BattleOpponentProfile,
  onMessage: (msg: BattleServerMessage) => void,
  onClose: () => void,
): BattleSocket {
  return connect(`/api/battles/room/${encodeURIComponent(matchId)}/ws`, playerId, profile, onMessage, onClose)
}

export interface BattleApiResult<T> {
  ok: boolean
  value?: T
}

export async function createFriendRoom(): Promise<CreateRoomResponse | null> {
  try {
    const res = await fetch('/api/battles/rooms', { method: 'POST' })
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; value?: CreateRoomResponse }
    return body.ok ? (body.value ?? null) : null
  } catch {
    return null
  }
}

export async function getRoomStatus(roomCode: string): Promise<RoomStatusResponse> {
  try {
    const res = await fetch(`/api/battles/rooms/${encodeURIComponent(roomCode)}`)
    return (await res.json()) as RoomStatusResponse
  } catch {
    return { ok: false, reason: 'not_found' }
  }
}

export interface BattleStatsResponse {
  wins: number
  losses: number
  draws: number
  currentStreak: number
  maxStreak: number
}

export async function fetchBattleStats(playerId: string): Promise<BattleStatsResponse | null> {
  try {
    const res = await fetch(`/api/battles/stats/${encodeURIComponent(playerId)}`)
    if (!res.ok) return null
    const body = (await res.json()) as { ok: boolean; value?: BattleStatsResponse }
    return body.ok ? (body.value ?? null) : null
  } catch {
    return null
  }
}
