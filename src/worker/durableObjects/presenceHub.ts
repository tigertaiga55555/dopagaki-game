import { isPresenceClientMessage, type PresenceServerMessage, type PresenceSnapshot, type PresenceState } from '../../presence/presenceTypes'
import type { PublicProfileSnapshot } from '../../friends/types'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 28/31）: プレイヤーのオンライン状態（ONLINE/
 * PLAYING/OFFLINE）を管理する単一グローバルDurable Object（worker/durableObjects/
 * matchmaker.tsと同じ、idFromName('global')の単一インスタンスパターン）。
 *
 * 状態はctx.storageへ永続化しない——「オフライン＝このHubへの接続が無い」という
 * WebSocketの生存そのものが状態の表現であり、DOが再起動してもHibernatable WebSocket
 * API（ctx.getWebSockets() + serializeAttachment）がアタッチメントを保持したまま
 * 繋ぎ直してくれるため、ここで独自の有効期限管理やハートビート監視を追加する必要がない。
 */
interface SocketAttachment {
  playerId: string
  state: PresenceState
  /** このソケットが購読しているフレンドのplayerId一覧（フレンド一覧画面を開いている間だけ非空）。 */
  subscribedIds: string[]
}

export class PresenceHub implements DurableObject {
  private readonly ctx: DurableObjectState

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx
  }

  private attachment(ws: WebSocket): SocketAttachment | null {
    return (ws.deserializeAttachment() as SocketAttachment | null) ?? null
  }

  private send(ws: WebSocket, message: PresenceServerMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // 既に閉じているソケット等。致命的ではない。
    }
  }

  /** 指定したplayerIdの現在の状態。接続が無ければoffline、1つでも'playing'があればplaying、それ以外はonline。 */
  private presenceOf(playerId: string): 'online' | 'playing' | 'offline' {
    const sockets = this.ctx.getWebSockets().map((ws) => this.attachment(ws)).filter((a): a is SocketAttachment => a !== null && a.playerId === playerId)
    if (sockets.length === 0) return 'offline'
    return sockets.some((a) => a.state === 'playing') ? 'playing' : 'online'
  }

  /** playerIdの状態が変わった可能性がある時に呼ぶ。playerIdを購読している全ソケットへ最新snapshotを送る。 */
  private broadcastPresenceChange(playerId: string): void {
    const value = this.presenceOf(playerId)
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachment(ws)
      if (!attachment || !attachment.subscribedIds.includes(playerId)) continue
      const snapshot: PresenceSnapshot = { [playerId]: value }
      this.send(ws, { v: 1, type: 'presence_snapshot', snapshot })
    }
  }

  /**
   * 次フェーズ（ゲーム機能クローズラウンド、item 75-77）: 招待相手が今まさに接続中なら
   * その場でroom_invite_receivedを届ける（届かなければ何もしない——呼び出し元
   * （worker/index.tsのPOST /api/rooms/private/:roomCode/invite）が、届いたかどうかに
   * 関わらず必ずD1へ永続化しているため、ここでの配信はあくまで「今すぐ気づいてもらう」
   * ための最適化に過ぎない。真の正本はD1のprivate_room_invitesテーブル側）。
   */
  private deliverRoomInviteIfOnline(toPlayerId: string, fromProfile: PublicProfileSnapshot, roomCode: string): boolean {
    const target = this.ctx.getWebSockets().find((other) => this.attachment(other)?.playerId === toPlayerId)
    if (!target) return false
    this.send(target, { v: 1, type: 'room_invite_received', fromProfile, roomCode })
    return true
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/internal/notify-room-invite') {
      const body = (await request.json().catch(() => null)) as { toPlayerId?: string; fromProfile?: PublicProfileSnapshot; roomCode?: string } | null
      if (!body || typeof body.toPlayerId !== 'string' || !body.fromProfile || typeof body.roomCode !== 'string') {
        return new Response('invalid body', { status: 400 })
      }
      const delivered = this.deliverRoomInviteIfOnline(body.toPlayerId, body.fromProfile, body.roomCode)
      return new Response(JSON.stringify({ ok: true, delivered }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }
    const playerId = url.searchParams.get('playerId')
    if (!playerId) return new Response('playerId is required', { status: 400 })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId, state: 'online', subscribedIds: [] } satisfies SocketAttachment)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (!isPresenceClientMessage(parsed)) return
    const attachment = this.attachment(ws)
    if (!attachment) return

    if (parsed.type === 'set_state') {
      const next: SocketAttachment = { ...attachment, state: parsed.state }
      ws.serializeAttachment(next)
      this.broadcastPresenceChange(attachment.playerId)
      return
    }

    if (parsed.type === 'subscribe') {
      const next: SocketAttachment = { ...attachment, subscribedIds: parsed.playerIds }
      ws.serializeAttachment(next)
      const snapshot: PresenceSnapshot = {}
      for (const id of parsed.playerIds) snapshot[id] = this.presenceOf(id)
      this.send(ws, { v: 1, type: 'presence_snapshot', snapshot })
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = this.attachment(ws)
    if (!attachment) return
    // このソケット自体は既にctx.getWebSockets()から外れている状態でも、同じplayerIdの
    // 別タブ接続が残っていればpresenceOfは正しくonline/playingを返す——closeしたソケット
    // だけを特別扱いする必要はない。
    this.broadcastPresenceChange(attachment.playerId)
  }
}
