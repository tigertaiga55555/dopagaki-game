import {
  addPlayer,
  applyDisconnect,
  applyForfeit,
  createRoom,
  decideStartIfReady,
  finalizeResult,
  getOpponentOf,
  getPlayer,
  isDisconnectTimedOut,
  markReady,
  submitAnswer,
  submitFinished,
  type BattleRoomState,
} from '../../battle/battleRoomEngine'
import { isBattleClientMessage, type BattleOpponentProfile, type BattleServerMessage } from '../../battle/types'
import { createD1BattleRepository } from '../battleRepository'
import type { ChallengeProblemSetItem } from '../../challenge/types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: 1試合ぶんのリアルタイム状態を管理するDurable
 * Object。世界対戦・フレンド対戦の両方がこの同じクラス・同じ状態機械を使う
 * （モードごとの二重実装は禁止、というユーザー指示）。実際の状態遷移・検証ロジックは
 * battle/battleRoomEngine.ts（純粋関数）に委譲し、このクラスはWebSocket Hibernation
 * API・ctx.storage・D1永続化との接続だけを担当する。
 */
const ROOM_STATE_KEY = 'roomState'
const COUNTDOWN_MS = 3000
const DISCONNECT_GRACE_MS = 5000

interface SocketAttachment {
  playerId: string
}

interface CreateBody {
  mode: 'world' | 'friend'
  roomCode: string | null
  problemSet: ChallengeProblemSetItem[]
  players: { playerId: string; profile: BattleOpponentProfile }[]
}

export class BattleRoom implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly env: Env

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env
  }

  private async loadState(): Promise<BattleRoomState | null> {
    return (await this.ctx.storage.get<BattleRoomState>(ROOM_STATE_KEY)) ?? null
  }

  private async saveState(state: BattleRoomState): Promise<void> {
    await this.ctx.storage.put(ROOM_STATE_KEY, state)
  }

  private socketFor(playerId: string): WebSocket | undefined {
    return this.ctx.getWebSockets().find((ws) => (ws.deserializeAttachment() as SocketAttachment | null)?.playerId === playerId)
  }

  private send(ws: WebSocket | undefined, message: BattleServerMessage): void {
    if (!ws) return
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // 既に閉じているソケット等。致命的ではない。
    }
  }

  private broadcastExcept(state: BattleRoomState, excludePlayerId: string, message: BattleServerMessage): void {
    for (const p of state.players) {
      if (p.playerId === excludePlayerId) continue
      this.send(this.socketFor(p.playerId), message)
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

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }
    return this.handleWebSocketUpgrade(request)
  }

  private async handleCreate(request: Request): Promise<Response> {
    const existing = await this.loadState()
    if (existing) return new Response(JSON.stringify({ ok: true }), { status: 200 })

    const body = (await request.json()) as CreateBody
    let state = createRoom(crypto.randomUUID(), body.mode, body.roomCode, body.problemSet)
    for (const p of body.players) {
      // この時点ではまだ誰の実WebSocketも開いていない（Matchmakerが2人を確定させた
      // 直後のロスター事前登録、またはフレンド対戦ホストの部屋作成直後）ため、
      // connected=falseで登録する。実接続はhandleWebSocketUpgrade側で初めてtrueになる。
      const result = addPlayer(state, p.playerId, p.profile, body.mode === 'world', false)
      if (result.ok) state = result.state
    }
    await this.saveState(state)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  private async handleStatus(): Promise<Response> {
    const state = await this.loadState()
    if (!state) return new Response(JSON.stringify({ ok: false, reason: 'not_found' }), { status: 200 })
    if (state.phase === 'finished' || state.phase === 'aborted') {
      return new Response(JSON.stringify({ ok: false, reason: 'ended' }), { status: 200 })
    }
    if (state.players.length >= 2) {
      return new Response(JSON.stringify({ ok: false, reason: 'full' }), { status: 200 })
    }
    const host = state.players[0]
    return new Response(JSON.stringify({ ok: true, hostProfile: host?.profile ?? null }), { status: 200 })
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

    let state = await this.loadState()
    if (!state) return new Response('room not found', { status: 404 })
    if (state.phase === 'finished' || state.phase === 'aborted') return new Response('room has ended', { status: 410 })

    const isExisting = getPlayer(state, playerId) !== undefined
    const result = addPlayer(state, playerId, profile, state.mode === 'world')
    if (!result.ok) return new Response(result.reason, { status: result.reason === 'full' ? 409 : 410 })
    state = result.state
    await this.saveState(state)

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId } satisfies SocketAttachment)

    const opponent = getOpponentOf(state, playerId)
    if (opponent) {
      if (!isExisting) {
        this.send(server, { v: 1, type: 'opponent_joined', opponent: opponent.profile })
        this.broadcastExcept(state, playerId, { v: 1, type: 'opponent_joined', opponent: profile })
      } else {
        this.broadcastExcept(state, playerId, { v: 1, type: 'opponent_reconnected' })
      }
    }
    await this.maybeStartCountdown()

    return new Response(null, { status: 101, webSocket: client })
  }

  private async maybeStartCountdown(): Promise<void> {
    let state = await this.loadState()
    if (!state) return
    const before = state.startAt
    state = decideStartIfReady(state, Date.now(), COUNTDOWN_MS)
    if (state.startAt !== before && state.startAt !== null) {
      await this.saveState(state)
      for (const p of state.players) {
        const opponent = getOpponentOf(state, p.playerId)
        if (!opponent) continue
        this.send(this.socketFor(p.playerId), {
          v: 1,
          type: 'countdown',
          startAt: state.startAt,
          problemSet: state.problemSet,
          opponent: opponent.profile,
        })
      }
    } else {
      await this.saveState(state)
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (!isBattleClientMessage(parsed)) return
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    const { playerId } = attachment

    if (parsed.type === 'ready') {
      let state = await this.loadState()
      if (!state) return
      state = markReady(state, playerId)
      await this.saveState(state)
      await this.maybeStartCountdown()
      return
    }

    if (parsed.type === 'answer') {
      const state = await this.loadState()
      if (!state) return
      const result = submitAnswer(state, playerId, {
        questionIndex: parsed.questionIndex,
        correct: parsed.correct,
        reactionMs: parsed.reactionMs,
        scoreDelta: parsed.scoreDelta,
        bonusGainDelta: parsed.bonusGainDelta,
      })
      if (result.ok) {
        await this.saveState(result.state)
      } else {
        this.send(ws, { v: 1, type: 'error', message: result.reason })
      }
      return
    }

    if (parsed.type === 'progress') {
      const state = await this.loadState()
      if (!state) return
      this.broadcastExcept(state, playerId, { v: 1, type: 'opponent_progress', percent: parsed.percent })
      return
    }

    if (parsed.type === 'finished') {
      let state = await this.loadState()
      if (!state) return
      const { state: nextState, bothFinished } = submitFinished(state, playerId, parsed.performance)
      state = nextState
      await this.saveState(state)
      if (bothFinished) await this.finish(state)
      return
    }

    if (parsed.type === 'forfeit') {
      let state = await this.loadState()
      if (!state) return
      state = applyForfeit(state, playerId)
      await this.saveState(state)
      await this.finish(state)
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    let state = await this.loadState()
    if (!state) return

    if (state.phase === 'waiting') {
      // item 25: 試合開始前（まだstartAt確定前）の退出は公式敗北にしない。単に部屋から外す。
      // friend対戦のホスト待機中キャンセル・ゲスト未合流時の切断はここに該当する。
      state = { ...state, players: state.players.filter((p) => p.playerId !== attachment.playerId) }
      await this.saveState(state)
      return
    }

    state = applyDisconnect(state, attachment.playerId, Date.now())
    await this.saveState(state)
    this.broadcastExcept(state, attachment.playerId, { v: 1, type: 'opponent_disconnected', graceMs: DISCONNECT_GRACE_MS })
    await this.ctx.storage.setAlarm(Date.now() + DISCONNECT_GRACE_MS)
  }

  async alarm(): Promise<void> {
    const state = await this.loadState()
    if (!state || state.phase !== 'in_progress') return
    const timedOut = state.players.find((p) => isDisconnectTimedOut(p, Date.now(), DISCONNECT_GRACE_MS))
    if (timedOut) await this.finish(state)
  }

  private async finish(state: BattleRoomState): Promise<void> {
    if (state.phase === 'finished' || state.phase === 'aborted') return
    const result = finalizeResult(state)
    const finishedState: BattleRoomState = { ...state, phase: 'finished', finishReason: result.finishReason, result }
    await this.saveState(finishedState)

    const [playerA, playerB] = state.players
    if (playerA) this.send(this.socketFor(playerA.playerId), { v: 1, type: 'battle_finish', result, viewerIsPlayerA: true })
    if (playerB) this.send(this.socketFor(playerB.playerId), { v: 1, type: 'battle_finish', result, viewerIsPlayerA: false })

    if (state.mode === 'world' && this.env.CHALLENGE_DB && playerA && playerB) {
      const repo = createD1BattleRepository(this.env.CHALLENGE_DB)
      await repo.recordMatch({
        matchId: state.matchId,
        mode: state.mode,
        player1Id: playerA.playerId,
        player2Id: playerB.playerId,
        player1Performance: result.playerA.performance,
        player2Performance: result.playerB.performance,
        winner: result.winner,
        decidedBy: result.decidedBy,
        startedAt: state.startAt ?? Date.now(),
        finishedAt: Date.now(),
        finishReason: result.finishReason,
      })
      if (result.finishReason !== 'invalid') {
        await repo.applyWorldResult(playerA.playerId, result.winner === 'playerA' ? 'win' : result.winner === 'draw' ? 'draw' : 'lose')
        await repo.applyWorldResult(playerB.playerId, result.winner === 'playerB' ? 'win' : result.winner === 'draw' ? 'draw' : 'lose')
      }
    }

    // item 34（Durable Object cleanup）: 正式データはD1へ保存済みのため、一時stateは
    // 試合終了後すぐに消す（終了済みBattleRoomの状態を永遠に保持しない）。
    await this.ctx.storage.deleteAll()
  }
}
