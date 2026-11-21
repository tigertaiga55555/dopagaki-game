import { isPresenceClientMessage } from './presenceTypes'
import type { PresenceClientMessage, PresenceServerMessage } from './presenceTypes'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 28）: battle/battleClient.ts・
 * battle/privateRoomClient.tsと完全に同じ方針の薄いクライアント層。
 * アプリが開いている間、App.tsxがこの接続を1本だけ張りっぱなしにする
 * （画面遷移ごとに繋ぎ直さない——set_stateメッセージだけで状態を伝える）。
 */
export interface PresenceSocket {
  send(message: PresenceClientMessage): void
  close(): void
}

function wsOrigin(): string {
  return window.location.origin.replace(/^http/, 'ws')
}

export function connectToPresenceHub(
  playerId: string,
  onMessage: (msg: PresenceServerMessage) => void,
  onClose: () => void,
): PresenceSocket {
  const url = `${wsOrigin()}/api/presence/ws?playerId=${encodeURIComponent(playerId)}`
  const socket = new WebSocket(url)
  const pending: PresenceClientMessage[] = []
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
    onMessage(parsed as PresenceServerMessage)
  })
  socket.addEventListener('close', onClose)

  return {
    send(message: PresenceClientMessage) {
      if (!isPresenceClientMessage(message)) return
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
