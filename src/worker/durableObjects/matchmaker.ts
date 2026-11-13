import { createMatchmakerState, dequeue, enqueue, findTimedOut, tryMatch, type MatchmakerState, type QueueEntry } from '../../battle/matchmakerEngine'
import { generateBattleProblemSet } from '../../battle/battleProblemSet'
import { isBattleClientMessage, type BattleOpponentProfile, type BattleServerMessage } from '../../battle/types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: 世界対戦の待機列を管理するDurable Object。
 * 1つのグローバルインスタンス（env.MATCHMAKER.idFromName('global')）として常に同じ
 * オブジェクトを使う。実際の待機順ロジックは全てbattle/matchmakerEngine.ts（純粋関数）に
 * 委譲し、このクラスはWebSocket Hibernation API・ctx.storageとの接続だけを担当する
 * （既存のuseChallenge500.ts等と同じ「pure engine + 薄いラッパー」方針をDurable Objectにも
 * 適用）。
 *
 * WebSocket Hibernation APIを使うため、DOはメッセージが来ていない間スリープしてよい
 * （常時起こし続ける設計を避ける、というユーザー指示）。そのため待機列状態は毎回
 * ctx.storageへ読み書きする（メモリ上のフィールドはhibernation後に消える前提で実装する）。
 */
const QUEUE_STATE_KEY = 'queueState'
const MATCHMAKING_TIMEOUT_MS = 15000

interface SocketAttachment {
  playerId: string
  profile: BattleOpponentProfile
}

export class Matchmaker implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly env: Env

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env
  }

  private async loadState(): Promise<MatchmakerState> {
    const stored = await this.ctx.storage.get<MatchmakerState>(QUEUE_STATE_KEY)
    return stored ?? createMatchmakerState()
  }

  private async saveState(state: MatchmakerState): Promise<void> {
    await this.ctx.storage.put(QUEUE_STATE_KEY, state)
  }

  private findSocketForPlayer(playerId: string): WebSocket | undefined {
    return this.ctx.getWebSockets().find((ws) => {
      const attachment = ws.deserializeAttachment() as SocketAttachment | null
      return attachment?.playerId === playerId
    })
  }

  private send(ws: WebSocket, message: BattleServerMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // ソケットが既に閉じている等。致命的ではないため無視する。
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const profileRaw = url.searchParams.get('profile')
    if (!playerId || !profileRaw) {
      return new Response('playerId and profile are required', { status: 400 })
    }
    let profile: BattleOpponentProfile
    try {
      profile = JSON.parse(profileRaw) as BattleOpponentProfile
    } catch {
      return new Response('profile must be valid JSON', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId, profile } satisfies SocketAttachment)
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
    if (!isBattleClientMessage(parsed)) return
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    const { playerId } = attachment

    if (parsed.type === 'join_world_queue') {
      await this.handleJoin(ws, playerId)
      return
    }
    if (parsed.type === 'cancel_world_queue') {
      const state = await this.loadState()
      await this.saveState(dequeue(state, playerId))
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    // item 25: マッチング待機中のキャンセル（切断含む）は敗北扱いにしない。単に列から外すだけ。
    const state = await this.loadState()
    await this.saveState(dequeue(state, attachment.playerId))
  }

  private async handleJoin(ws: WebSocket, playerId: string): Promise<void> {
    // プロフィール本体はWebSocket接続時のクエリパラメータとして渡す簡易実装（既存Profileの
    // スナップショットをそのまま使い、Battle専用プロフィールDBは作らない——ユーザー指示）。
    const attachment = ws.deserializeAttachment() as SocketAttachment
    const profile = attachment.profile
    let state = await this.loadState()
    const entry: QueueEntry = { playerId, profile, joinedAt: Date.now() }
    state = enqueue(state, entry)
    this.send(ws, { v: 1, type: 'queue_joined' })

    const matched = tryMatch(state)
    if (matched) {
      state = matched.state
      await this.saveState(state)
      await this.createMatch(matched.pair.a, matched.pair.b)
    } else {
      await this.saveState(state)
      await this.scheduleNextTimeoutAlarm(state)
    }
  }

  private async createMatch(a: QueueEntry, b: QueueEntry): Promise<void> {
    // idFromName（任意の文字列から決定論的にDO idを導出）を世界対戦・フレンド対戦の両方で
    // 統一して使う（フレンド対戦はroomCode文字列をそのままmatchIdとして使うため、
    // Worker側のルーティングがモードを意識せず同じ導出方法で済む）。
    const matchId = crypto.randomUUID()
    const stub = this.env.BATTLE_ROOM!.get(this.env.BATTLE_ROOM!.idFromName(matchId))
    const problemSet = generateBattleProblemSet()
    await stub.fetch('https://battle-room/internal/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'world',
        roomCode: null,
        problemSet,
        players: [
          { playerId: a.playerId, profile: a.profile },
          { playerId: b.playerId, profile: b.profile },
        ],
      }),
    })

    const socketA = this.findSocketForPlayer(a.playerId)
    const socketB = this.findSocketForPlayer(b.playerId)
    if (socketA) this.send(socketA, { v: 1, type: 'match_found', matchId, opponent: b.profile })
    if (socketB) this.send(socketB, { v: 1, type: 'match_found', matchId, opponent: a.profile })
  }

  private async scheduleNextTimeoutAlarm(state: MatchmakerState): Promise<void> {
    if (state.queue.length === 0) return
    const earliestJoinedAt = Math.min(...state.queue.map((e) => e.joinedAt))
    await this.ctx.storage.setAlarm(earliestJoinedAt + MATCHMAKING_TIMEOUT_MS)
  }

  async alarm(): Promise<void> {
    const now = Date.now()
    let state = await this.loadState()
    const timedOut = findTimedOut(state, now, MATCHMAKING_TIMEOUT_MS)
    for (const entry of timedOut) {
      state = dequeue(state, entry.playerId)
      const ws = this.findSocketForPlayer(entry.playerId)
      if (ws) this.send(ws, { v: 1, type: 'queue_timeout' })
    }
    await this.saveState(state)
    await this.scheduleNextTimeoutAlarm(state)
  }
}
