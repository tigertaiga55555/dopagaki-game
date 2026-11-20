import { generateBattleProblemSet } from '../../battle/battleProblemSet'
import { generateEndlessBattleProblemSet } from '../../battle/endlessBattleProblemSet'
import {
  addMember,
  applyMatchResult,
  closeRoom,
  createPrivateRoomState,
  setMemberConnected,
  startMatch,
  type MatchOutcome,
  type PrivateRoomState,
} from '../../battle/privateRoomEngine'
import { isPrivateRoomClientMessage, type PrivateRoomServerMessage, type PrivateRoomStatusResponse } from '../../battle/privateRoomTypes'
import type { BattleOpponentProfile } from '../../battle/types'
import { createD1PrivateRoomRepository } from '../privateRoomRepository'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOM（ロビー）の
 * リアルタイム状態を管理するDurable Object。worker/durableObjects/battleRoom.tsと同じ
 * 方針（WebSocket Hibernation API、実際の状態遷移・検証はbattle/privateRoomEngine.ts
 * （純粋関数）に委譲し、このクラスはWebSocket・ctx.storage・D1（1部屋/ホスト強制の解放のみ）
 * との接続だけを担当する）。
 *
 * 実際の1v1対戦（NORMAL/ENDLESS）のロジック・接続・同期は一切複製しない——
 * startMatch時にBATTLE_ROOM bindingへ既存のBattleRoom DO（既存の1v1対戦エンジン、実績あり）
 * を新規生成するだけで、ロビー自身は対戦中の問題配信・回答検証を一切行わない。
 */
const ROOM_STATE_KEY = 'privateRoomState'

interface SocketAttachment {
  playerId: string
}

interface CreateBody {
  roomCode: string
  hostPlayerId: string
  hostProfile: BattleOpponentProfile
}

interface MatchFinishedBody {
  matchId: string
  outcome: MatchOutcome
}

export class PrivateRoom implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly env: Env

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env
  }

  private async loadState(): Promise<PrivateRoomState | null> {
    return (await this.ctx.storage.get<PrivateRoomState>(ROOM_STATE_KEY)) ?? null
  }

  private async saveState(state: PrivateRoomState): Promise<void> {
    await this.ctx.storage.put(ROOM_STATE_KEY, state)
  }

  private socketFor(playerId: string): WebSocket | undefined {
    return this.ctx.getWebSockets().find((ws) => (ws.deserializeAttachment() as SocketAttachment | null)?.playerId === playerId)
  }

  private send(ws: WebSocket | undefined, message: PrivateRoomServerMessage): void {
    if (!ws) return
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // 既に閉じているソケット等。致命的ではない。
    }
  }

  private broadcastState(state: PrivateRoomState): void {
    for (const m of state.members) {
      this.send(this.socketFor(m.playerId), { v: 1, type: 'room_state', state })
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/internal/create' && request.method === 'POST') {
      return this.handleCreate(request)
    }
    if (url.pathname === '/internal/status' && request.method === 'GET') {
      return this.handleStatus()
    }
    if (url.pathname === '/internal/match-finished' && request.method === 'POST') {
      return this.handleMatchFinished(request)
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }
    return this.handleWebSocketUpgrade(request)
  }

  private async handleCreate(request: Request): Promise<Response> {
    const existing = await this.loadState()
    if (existing) return new Response(JSON.stringify({ ok: true }), { status: 200 })

    const body = (await request.json()) as CreateBody
    const state = createPrivateRoomState(body.roomCode, body.hostPlayerId, body.hostProfile, Date.now())
    await this.saveState(state)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  private async handleStatus(): Promise<Response> {
    const state = await this.loadState()
    if (!state) return new Response(JSON.stringify({ ok: false, reason: 'not_found' } satisfies PrivateRoomStatusResponse), { status: 200 })
    if (state.closed) return new Response(JSON.stringify({ ok: false, reason: 'closed' } satisfies PrivateRoomStatusResponse), { status: 200 })
    return new Response(
      JSON.stringify({ ok: true, closed: false, memberCount: state.members.length } satisfies PrivateRoomStatusResponse),
      { status: 200 },
    )
  }

  /**
   * BattleRoom DO（notifyPrivateRoomIfAny）からのサーバー間通知。クライアントからの
   * 自己申告ではなく、実際にBattleRoomが確定した結果だけをここで反映する
   * ——room-scoped戦績もWorldBattleのD1統計と同じ「サーバー権威」の原則を保つ。
   */
  private async handleMatchFinished(request: Request): Promise<Response> {
    const state = await this.loadState()
    if (!state) return new Response(JSON.stringify({ ok: false }), { status: 200 })
    const body = (await request.json()) as MatchFinishedBody
    const nextState = applyMatchResult(state, body.matchId, body.outcome)
    await this.saveState(nextState)
    this.broadcastState(nextState)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const profileRaw = url.searchParams.get('profile')
    if (!playerId || !profileRaw) return new Response('playerId and profile are required', { status: 400 })
    let profile: BattleOpponentProfile
    try {
      profile = JSON.parse(profileRaw) as BattleOpponentProfile
    } catch {
      return new Response('profile must be valid JSON', { status: 400 })
    }

    const state = await this.loadState()
    if (!state) return new Response('room not found', { status: 404 })

    const result = addMember(state, playerId, profile)
    if (!result.ok) return new Response(result.reason, { status: result.reason === 'full' ? 409 : 410 })
    await this.saveState(result.state)

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId } satisfies SocketAttachment)

    this.broadcastState(result.state)

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
    if (!isPrivateRoomClientMessage(parsed)) return
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    const { playerId } = attachment

    if (parsed.type === 'start_match') {
      const state = await this.loadState()
      if (!state) return
      const matchId = crypto.randomUUID()
      const result = startMatch(state, playerId, parsed.memberAId, parsed.memberBId, matchId, parsed.battleType, parsed.endlessDifficulty)
      if (!result.ok) {
        this.send(ws, { v: 1, type: 'error', message: result.reason })
        return
      }

      const memberA = result.state.members.find((m) => m.playerId === parsed.memberAId)
      const memberB = result.state.members.find((m) => m.playerId === parsed.memberBId)
      if (!memberA || !memberB || !this.env.BATTLE_ROOM) {
        this.send(ws, { v: 1, type: 'error', message: 'battle backend is not configured' })
        return
      }

      const problemSet =
        parsed.battleType === 'endless' && parsed.endlessDifficulty
          ? generateEndlessBattleProblemSet(parsed.endlessDifficulty)
          : generateBattleProblemSet()

      const stub = this.env.BATTLE_ROOM.get(this.env.BATTLE_ROOM.idFromName(matchId))
      await stub.fetch('https://battle-room.internal/internal/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'friend',
          roomCode: null,
          problemSet,
          players: [
            { playerId: memberA.playerId, profile: memberA.profile },
            { playerId: memberB.playerId, profile: memberB.profile },
          ],
          battleType: parsed.battleType,
          notifyPrivateRoomCode: state.roomCode,
        }),
      })

      await this.saveState(result.state)
      this.broadcastState(result.state)
      return
    }

    if (parsed.type === 'close_room') {
      const state = await this.loadState()
      if (!state) return
      if (playerId !== state.hostPlayerId) {
        this.send(ws, { v: 1, type: 'error', message: 'not_host' })
        return
      }
      const nextState = closeRoom(state)
      await this.saveState(nextState)
      for (const m of nextState.members) {
        this.send(this.socketFor(m.playerId), { v: 1, type: 'room_closed' })
      }
      if (this.env.CHALLENGE_DB) {
        await createD1PrivateRoomRepository(this.env.CHALLENGE_DB).releaseRoomForHost(state.hostPlayerId)
      }
      await this.ctx.storage.deleteAll()
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    const state = await this.loadState()
    if (!state) return
    const nextState = setMemberConnected(state, attachment.playerId, false)
    await this.saveState(nextState)
    this.broadcastState(nextState)
  }
}
