import { generateBattleProblemSet } from '../../battle/battleProblemSet'
import { generateEndlessBattleProblemSet } from '../../battle/endlessBattleProblemSet'
import {
  PRIVATE_ROOM_INACTIVITY_MS,
  addMember,
  applyMatchResult,
  bothSeatsReady,
  closeRoom,
  createPrivateRoomState,
  enterTable,
  isExpired,
  leaveTable,
  setMemberConnected,
  setTableReady,
  setTableRules,
  startTableMatch,
  touchActivity,
  type ApplyMatchResultDetail,
  type MatchOutcome,
  type PrivateRoomState,
} from '../../battle/privateRoomEngine'
import {
  isPrivateRoomClientMessage,
  type PrivateRoomServerMessage,
  type PrivateRoomStatusResponse,
  type RoomClosedReason,
} from '../../battle/privateRoomTypes'
import type { BattleOpponentProfile } from '../../battle/types'
import { createD1PrivateRoomRepository } from '../privateRoomRepository'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM → FRIENDS/TABLE/ナビ追加調整
 * ラウンド、item 43-47で大幅改修）: PRIVATE ROOM（ロビー）のリアルタイム状態を管理する
 * Durable Object。worker/durableObjects/battleRoom.tsと同じ方針（WebSocket Hibernation
 * API、実際の状態遷移・検証はbattle/privateRoomEngine.ts（純粋関数）に委譲し、このクラスは
 * WebSocket・ctx.storage・D1との接続だけを担当する）。
 *
 * item 43: 「ホストが都度2人を選ぶ」のではなく、両座席がREADYになった瞬間にこのDO自身が
 * 自動的に対戦を開始する。TABLEごとに別々のBattleRoom DOインスタンスを生成するため、
 * 複数TABLEの対戦が完全に並行して進行できる（ロビー自身はどの対戦の問題配信・回答検証も
 * 一切行わない、という既存の責務分離を維持）。
 *
 * item 45-47: 6時間の無活動で部屋を期限切れにする（DOのalarmに加えて、どの操作でも
 * アクセスのたびに期限切れを確認する——alarmの発火だけに依存しない、というユーザーの
 * 明示指示）。切断は退出ではない（setMemberConnectedはロスターから一切取り除かない）。
 * ホスト専用の操作はclose_roomの1つだけに縮小されているため、ホストが一時的にオフラインに
 * なっても、それ以外の全操作（TABLE入席・ルール選択・READY・対戦）は誰にも影響されず継続する。
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
  detail?: ApplyMatchResultDetail
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

  /**
   * item 45: lastActivityAtが変わる操作のあとは必ずこれを使う——保存に加えて、
   * 「最後の活動から6時間後」にこのDO自身を起こすalarmを再設定する（既存のalarmを
   * 新しいものへ単純に置き換えるだけ、Durable Objectは1つのalarmしか持てない）。
   */
  private async saveStateAndScheduleExpiry(state: PrivateRoomState): Promise<void> {
    await this.saveState(state)
    await this.ctx.storage.setAlarm(state.lastActivityAt + PRIVATE_ROOM_INACTIVITY_MS)
  }

  /**
   * item 45: どの操作の入口でも必ずこれ経由で状態を読む——alarmの発火だけに依存せず、
   * アクセスのたびに期限切れを確認する（ユーザーの明示指示）。期限切れなら、この場で
   * finalizeRoomClosure('expired')を実行してからnullを返す（＝呼び出し元には「もう存在しない
   * 部屋」として振る舞わせる）。
   */
  private async loadActiveState(): Promise<PrivateRoomState | null> {
    const state = await this.loadState()
    if (!state || state.closed) return null
    if (isExpired(state, Date.now())) {
      await this.finalizeRoomClosure(state, 'expired')
      return null
    }
    return state
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

  /**
   * item 44/46-47: ホストによる明示的なclose、または6時間無活動による期限切れ、どちらも
   * この1つの経路に集約する——①まだ接続中の全員へroom_closedを通知、②D1へ確定済みの
   * ルーム履歴（セッションサマリー＋試合詳細）を書き込み、③全メンバーのmembership行を
   * 一括削除（「参加中のルームに戻る」が存在しないルームを指さないようにする）、
   * ④ホストのclaimを解放、⑤ctx.storageを完全に消す。
   */
  private async finalizeRoomClosure(state: PrivateRoomState, reason: RoomClosedReason): Promise<void> {
    const closedState = closeRoom(state)
    for (const m of closedState.members) {
      this.send(this.socketFor(m.playerId), { v: 1, type: 'room_closed', reason })
    }
    if (this.env.CHALLENGE_DB) {
      const repo = createD1PrivateRoomRepository(this.env.CHALLENGE_DB)
      await repo.recordClosedRoomSession(
        {
          roomCode: state.roomCode,
          hostPlayerId: state.hostPlayerId,
          createdAt: state.createdAt,
          endedAt: Date.now(),
          memberCount: state.members.length,
          matchCount: state.matchHistory.length,
        },
        state.matchHistory,
      )
      await repo.clearMembershipsForRoom(state.roomCode)
      await repo.releaseRoomForHost(state.hostPlayerId)
      // item 75-77: ルームが本当に消えた以上、このルーム宛ての未処理招待も意味を失う。
      await repo.clearInvitesForRoom(state.roomCode)
    }
    await this.ctx.storage.deleteAll()
    await this.ctx.storage.deleteAlarm()
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
    await this.saveStateAndScheduleExpiry(state)
    if (this.env.CHALLENGE_DB) {
      await createD1PrivateRoomRepository(this.env.CHALLENGE_DB).recordMembership(body.hostPlayerId, body.roomCode, Date.now())
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  private async handleStatus(): Promise<Response> {
    const state = await this.loadActiveState()
    if (!state) return new Response(JSON.stringify({ ok: false, reason: 'not_found' } satisfies PrivateRoomStatusResponse), { status: 200 })
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
    const state = await this.loadActiveState()
    if (!state) return new Response(JSON.stringify({ ok: false }), { status: 200 })
    const body = (await request.json()) as MatchFinishedBody
    const nextState = applyMatchResult(state, body.matchId, body.outcome, body.detail ?? {}, Date.now())
    await this.saveStateAndScheduleExpiry(nextState)
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

    const state = await this.loadActiveState()
    if (!state) return new Response('room not found', { status: 404 })

    const result = addMember(state, playerId, profile, Date.now())
    if (!result.ok) return new Response(result.reason, { status: result.reason === 'full' ? 409 : 410 })
    await this.saveStateAndScheduleExpiry(result.state)
    if (this.env.CHALLENGE_DB) {
      const repo = createD1PrivateRoomRepository(this.env.CHALLENGE_DB)
      await repo.recordMembership(playerId, state.roomCode, Date.now())
      // item 75-77: 実際に参加した以上、この人宛てのこのルームの招待（あれば）はもう役目を終えている。
      await repo.deleteRoomInvite(state.roomCode, playerId)
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId } satisfies SocketAttachment)

    this.broadcastState(result.state)

    return new Response(null, { status: 101, webSocket: client })
  }

  /** item 43: 両座席がREADYになった瞬間、サーバー側が自動的にBattleRoom DOを新規生成して対戦を開始する。 */
  private async startMatchForTable(state: PrivateRoomState, tableId: number): Promise<void> {
    const table = state.tables.find((t) => t.tableId === tableId)
    if (!table || !this.env.BATTLE_ROOM) return
    const memberA = state.members.find((m) => m.playerId === table.seatAId)
    const memberB = state.members.find((m) => m.playerId === table.seatBId)
    if (!memberA || !memberB) return

    const matchId = crypto.randomUUID()
    const started = startTableMatch(state, tableId, matchId)
    if (!started.ok) return

    const problemSet =
      table.battleType === 'endless' && table.endlessDifficulty ? generateEndlessBattleProblemSet(table.endlessDifficulty) : generateBattleProblemSet()

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
        battleType: table.battleType,
        notifyPrivateRoomCode: state.roomCode,
        // このDOをidFromName(matchId)で直接アドレスしているため、BattleRoom DO内部の
        // state.matchIdもこれと完全に一致させる（notifyPrivateRoomIfAnyでの
        // applyMatchResultのmatchId照合が成立するために必須）。
        matchId,
      }),
    })

    await this.saveStateAndScheduleExpiry(started.state)
    this.broadcastState(started.state)
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

    if (parsed.type === 'enter_table') {
      const state = await this.loadActiveState()
      if (!state) return
      const result = enterTable(state, playerId, parsed.tableId)
      if (!result.ok) {
        this.send(ws, { v: 1, type: 'error', message: result.reason })
        return
      }
      await this.saveStateAndScheduleExpiry(result.state)
      this.broadcastState(result.state)
      return
    }

    if (parsed.type === 'leave_table') {
      const state = await this.loadActiveState()
      if (!state) return
      const result = leaveTable(state, playerId)
      if (!result.ok) {
        this.send(ws, { v: 1, type: 'error', message: result.reason })
        return
      }
      await this.saveStateAndScheduleExpiry(result.state)
      this.broadcastState(result.state)
      return
    }

    if (parsed.type === 'set_table_rules') {
      const state = await this.loadActiveState()
      if (!state) return
      const result = setTableRules(state, playerId, parsed.tableId, parsed.battleType, parsed.endlessDifficulty)
      if (!result.ok) {
        this.send(ws, { v: 1, type: 'error', message: result.reason })
        return
      }
      // item 45: ルールの選択自体は「意味のある操作」の明示リストに含めていないため、
      // lastActivityAtは更新しない（プレーンなsaveStateを使う）。
      await this.saveState(result.state)
      this.broadcastState(result.state)
      return
    }

    if (parsed.type === 'set_table_ready') {
      const state = await this.loadActiveState()
      if (!state) return
      const result = setTableReady(state, playerId, parsed.tableId, parsed.ready)
      if (!result.ok) {
        this.send(ws, { v: 1, type: 'error', message: result.reason })
        return
      }
      await this.saveState(result.state)
      this.broadcastState(result.state)

      const table = result.state.tables.find((t) => t.tableId === parsed.tableId)
      if (table && bothSeatsReady(table)) {
        await this.startMatchForTable(result.state, parsed.tableId)
      }
      return
    }

    if (parsed.type === 'close_room') {
      const state = await this.loadActiveState()
      if (!state) return
      if (playerId !== state.hostPlayerId) {
        this.send(ws, { v: 1, type: 'error', message: 'not_host' })
        return
      }
      await this.finalizeRoomClosure(state, 'host_closed')
      return
    }

    if (parsed.type === 'touch_activity') {
      const state = await this.loadActiveState()
      if (!state) return
      await this.saveStateAndScheduleExpiry(touchActivity(state, Date.now()))
      return
    }

    if (parsed.type === 'request_state') {
      const state = await this.loadActiveState()
      if (state) this.send(ws, { v: 1, type: 'room_state', state })
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment) return
    const state = await this.loadState()
    if (!state || state.closed) return
    // item 46-47: 切断は退出ではない——connectedフラグを落とすだけで、ロスター・座席の
    // どちらからも一切取り除かない。期限切れ判定（loadActiveState）は意図的に経由しない
    // （単なる切断検知自体はlastActivityAtを更新する「意味のある操作」ではないため、
    // ここで期限切れを確定させてしまうと「プレゼンスの接続維持だけでは活動扱いしない」
    // という方針と矛盾する）。
    const nextState = setMemberConnected(state, attachment.playerId, false)
    await this.saveState(nextState)
    this.broadcastState(nextState)
  }

  async alarm(): Promise<void> {
    const state = await this.loadState()
    if (!state || state.closed) return
    if (isExpired(state, Date.now())) {
      await this.finalizeRoomClosure(state, 'expired')
    }
  }
}
