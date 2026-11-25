import type { BattleFormat, BattleOpponentProfile } from './types'
import type { EndlessDifficulty } from '../types'

/**
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 43以降）: PRIVATE ROOM（ロビー）の
 * Durable Object内部状態を管理する純粋関数群。battle/battleRoomEngine.tsと同じ
 * 「pure engine + 薄いDOラッパー」方針（DurableObjectState・WebSocket等に一切依存しない
 * ため、vitestで直接テストできる）。
 *
 * 旧設計からの大きな変更点（item 43）: 「ホストが都度2人を選んで対戦を組む」方式を廃止し、
 * 「最大4つのTABLE（各2席）をロビーに常設し、誰でも空席にENTRY/READYできる」方式へ
 * 完全に置き換えた。ホストの役割は「ルームを閉じる」権限だけに縮小される——対戦の
 * 組み合わせ自体にホストは一切関与しない。複数TABLEが同時に別々の対戦を進行できる
 * （各TABLEのactiveMatchは独立しており、既存のBattleRoom DOを「TABLEごとに1インスタンス」
 * 生成する方針はDOラッパー側（durableObjects/privateRoom.ts）の責務）。
 *
 * コーディネーターからの明示指示: room formatは'FREE'を今すぐ実装するが、将来
 * 'LEAGUE'/'TOURNAMENT'も追加できる拡張可能な設計にする（1v1単一形式専用の設計にしない）。
 * そのため、PrivateRoomFormatをunion型にしておく（今回のリテラルは'FREE'の1つだけだが、
 * 将来の追加はこの型への1行追加＋新しい分岐の追加だけで済み、既存のFREE専用ロジックを
 * 書き換える必要がない）。TABLE自体も、将来のLEAGUE/TOURNAMENTでテーブル数・座席数の
 * 意味が変わり得ることを見越して、定数化（ハードコードを複数箇所に散らさない）してある。
 */
export type PrivateRoomFormat = 'FREE'

/**
 * 最大メンバー数（ホスト含む）。単一のconfig値として一箇所にだけ定義し、
 * ハードコードを複数箇所に散らさない（コーディネーターからの明示指示）。
 *
 * 根拠（最終報告書にも記載）: Cloudflare Durable Object側の技術的制約
 * （Hibernatable WebSocketは1つのDOあたり数百〜数千接続に対応でき、ロビー8人程度では
 * 全く問題にならない）はこの規模では実質的な制約にならないため、制約の本質は
 * ロビーUXの側にある——390px幅の画面でメンバー一覧（アバター＋ニックネーム＋状態）を
 * スクロールなしまたは短いスクロールで把握できる人数として、通常の「フレンドグループ」
 * （3〜6人程度）より少し余裕を持たせつつ、無制限に増やしてDO単体のstate blobや
 * ロビー表示が肥大化しないよう8人を上限とした。
 */
export const PRIVATE_ROOM_MAX_MEMBERS = 8

/** item 43: TABLEの最大数（8人 ÷ 2席 = 4）。将来LEAGUE/TOURNAMENTでも参照する単一のconfig値。 */
export const PRIVATE_ROOM_MAX_TABLES = 4
/** item 43: 1TABLEあたりの座席数。1v1前提のFREE形式では常に2。 */
export const PRIVATE_ROOM_SEATS_PER_TABLE = 2

/**
 * item 45: 6時間、最後の「意味のある操作」が無ければ部屋を期限切れにする。
 * lastActivityAtは、合流／TABLEへの入席・退席／対戦の開始・終了／フレンド招待の送信
 * だけで更新し、ロビーWebSocketのプレゼンス的な接続維持（request_state等）だけでは
 * 絶対に更新しない——タブを開いたまま放置しているだけのユーザーが部屋を無期限に
 * 生かし続けてしまわないようにする、というユーザーの明示指示。
 */
export const PRIVATE_ROOM_INACTIVITY_MS = 6 * 60 * 60 * 1000

/** item 44: ロビーに表示する試合履歴フィード（新しい順）の保持件数上限。DOのstorage blobが無限に肥大化しないための技術的な上限。 */
export const PRIVATE_ROOM_MATCH_HISTORY_CAP = 50

export interface PrivateRoomMemberStats {
  wins: number
  losses: number
  draws: number
}

export interface PrivateRoomMember {
  playerId: string
  profile: BattleOpponentProfile
  connected: boolean
  stats: PrivateRoomMemberStats
}

/** TABLEで現在進行中のマッチ。 */
export interface PrivateRoomActiveMatch {
  matchId: string
  battleType: BattleFormat
  endlessDifficulty: EndlessDifficulty | null
  memberAId: string
  memberBId: string
}

/**
 * item 43: 1つのTABLE。座席（seatAId/seatBId）に座った2人が共同でルール
 * （battleType/endlessDifficulty）を選び、両者がREADYになった瞬間に対戦が始まる。
 * ルールを変更すると（どちらが変更しても）readyPlayerIdsは必ずリセットされる
 * （「ready状態のままルールだけ変わってしまう」という不整合を防ぐ、ユーザーの明示指示）。
 */
export interface PrivateRoomTable {
  tableId: number
  seatAId: string | null
  seatBId: string | null
  battleType: BattleFormat
  endlessDifficulty: EndlessDifficulty | null
  /** 現在のbattleType/endlessDifficultyに対してREADYを押しているplayerIdの集合（0〜2件）。 */
  readyPlayerIds: string[]
  activeMatch: PrivateRoomActiveMatch | null
}

export type MatchOutcome = 'a' | 'b' | 'draw'

/**
 * item 44: ロビーの試合履歴フィード1件。「PASS所有者向けの『自分が作成したルームの履歴』
 * 機能」を将来追加できるデータ形状にしてある（date=finishedAt、1部屋あたりの試合件数は
 * この配列の長さ、各試合の詳細=この1件そのもの）——今回は集計画面を作らず、このロビー内の
 * 新しい順フィード表示だけに使う（データモデルだけ先に正しく用意する、という
 * コーディネーターからの明示指示）。
 *
 * normalはplayerXFinalDopaPercent、endlessはplayerXStreakだけが埋まる（互いに無関係な
 * 値を架空の0で埋めない——undefinedのまま、というこれまでの誠実さ方針を踏襲）。
 */
export interface PrivateRoomMatchHistoryEntry {
  matchId: string
  tableId: number
  finishedAt: number
  playerAId: string
  playerANickname: string
  playerBId: string
  playerBNickname: string
  winner: MatchOutcome
  battleType: BattleFormat
  endlessDifficulty: EndlessDifficulty | null
  playerAFinalDopaPercent?: number
  playerBFinalDopaPercent?: number
  playerAStreak?: number
  playerBStreak?: number
}

export interface PrivateRoomState {
  roomCode: string
  format: PrivateRoomFormat
  hostPlayerId: string
  members: PrivateRoomMember[]
  /** 常にPRIVATE_ROOM_MAX_TABLES件（空のTABLEも含む）。画面側はvisibleTableCount()で表示数を絞る。 */
  tables: PrivateRoomTable[]
  /** 新しい順（先頭が最新）。PRIVATE_ROOM_MATCH_HISTORY_CAP件を超えたら古い方から切り捨てる。 */
  matchHistory: PrivateRoomMatchHistoryEntry[]
  closed: boolean
  createdAt: number
  /** item 45: 最後に「意味のある操作」があった時刻。 */
  lastActivityAt: number
}

function createMember(playerId: string, profile: BattleOpponentProfile, connected: boolean): PrivateRoomMember {
  return { playerId, profile, connected, stats: { wins: 0, losses: 0, draws: 0 } }
}

function createEmptyTable(tableId: number): PrivateRoomTable {
  return { tableId, seatAId: null, seatBId: null, battleType: 'normal', endlessDifficulty: null, readyPlayerIds: [], activeMatch: null }
}

export function createPrivateRoomState(roomCode: string, hostPlayerId: string, hostProfile: BattleOpponentProfile, nowMs: number): PrivateRoomState {
  return {
    roomCode,
    format: 'FREE',
    hostPlayerId,
    members: [createMember(hostPlayerId, hostProfile, false)],
    tables: Array.from({ length: PRIVATE_ROOM_MAX_TABLES }, (_, i) => createEmptyTable(i + 1)),
    matchHistory: [],
    closed: false,
    createdAt: nowMs,
    lastActivityAt: nowMs,
  }
}

export function getMember(state: PrivateRoomState, playerId: string): PrivateRoomMember | undefined {
  return state.members.find((m) => m.playerId === playerId)
}

function getTable(state: PrivateRoomState, tableId: number): PrivateRoomTable | undefined {
  return state.tables.find((t) => t.tableId === tableId)
}

function replaceTable(state: PrivateRoomState, next: PrivateRoomTable): PrivateRoomState {
  return { ...state, tables: state.tables.map((t) => (t.tableId === next.tableId ? next : t)) }
}

/** item 43: メンバー数から、今ロビーに表示すべきTABLE数（1〜PRIVATE_ROOM_MAX_TABLES）を決める。3人→TABLE1/2、8人→TABLE1-4。 */
export function visibleTableCount(memberCount: number): number {
  return Math.max(1, Math.min(PRIVATE_ROOM_MAX_TABLES, Math.ceil(memberCount / PRIVATE_ROOM_SEATS_PER_TABLE)))
}

/** 指定したplayerIdが現在座っているTABLEを探す（どの座席にも居なければundefined）。 */
export function findTableOf(state: PrivateRoomState, playerId: string): PrivateRoomTable | undefined {
  return state.tables.find((t) => t.seatAId === playerId || t.seatBId === playerId)
}

export type AddMemberResult = { ok: true; state: PrivateRoomState } | { ok: false; reason: 'closed' | 'full' }

/**
 * 部屋への合流（item: JOINING a private room is free for everyone）。既存メンバーの
 * 再合流（切断後の再接続）はconnected=trueに戻すだけで、満員判定の対象にしない
 * （既にロスターに居る＝既存の1席を使っているだけのため）。
 *
 * item 45/46: 合流は「意味のある操作」なのでlastActivityAtを更新する。
 */
export function addMember(state: PrivateRoomState, playerId: string, profile: BattleOpponentProfile, nowMs: number): AddMemberResult {
  if (state.closed) return { ok: false, reason: 'closed' }
  const existing = getMember(state, playerId)
  if (existing) {
    const members = state.members.map((m) => (m.playerId === playerId ? { ...m, connected: true, profile } : m))
    return { ok: true, state: { ...state, members, lastActivityAt: nowMs } }
  }
  if (state.members.length >= PRIVATE_ROOM_MAX_MEMBERS) return { ok: false, reason: 'full' }
  return { ok: true, state: { ...state, members: [...state.members, createMember(playerId, profile, true)], lastActivityAt: nowMs } }
}

/**
 * item 46/47: 切断は「退出」ではない——connectedフラグを落とすだけで、ロスター（members）
 * ・座席（tables）のどちらからも一切取り除かない。ホストが一時的にオフラインになっても
 * 部屋は終了せず、他のメンバーのTABLE操作にも影響しない（ホスト専用の操作はclose_roomの
 * 1つだけに縮小されているため、ホスト不在時に不可能になるのもその1操作だけで済む）。
 */
export function setMemberConnected(state: PrivateRoomState, playerId: string, connected: boolean): PrivateRoomState {
  const members = state.members.map((m) => (m.playerId === playerId ? { ...m, connected } : m))
  return { ...state, members }
}

export type EnterTableResult =
  | { ok: true; state: PrivateRoomState }
  | { ok: false; reason: 'closed' | 'member_not_found' | 'already_seated' | 'invalid_table' | 'table_full' }

/**
 * item 43: 誰でも空席へ自分でENTRYできる（ホストによる任命は廃止）。既に別のTABLEに
 * 座っている場合は先にleaveTableしてもらう（暗黒の「勝手に席を移動する」挙動は作らない、
 * 明示的な離席操作を要求する）。
 */
export function enterTable(state: PrivateRoomState, playerId: string, tableId: number): EnterTableResult {
  if (state.closed) return { ok: false, reason: 'closed' }
  if (!getMember(state, playerId)) return { ok: false, reason: 'member_not_found' }
  if (findTableOf(state, playerId)) return { ok: false, reason: 'already_seated' }
  if (tableId < 1 || tableId > visibleTableCount(state.members.length)) return { ok: false, reason: 'invalid_table' }
  const table = getTable(state, tableId)
  if (!table) return { ok: false, reason: 'invalid_table' }
  if (table.seatAId !== null && table.seatBId !== null) return { ok: false, reason: 'table_full' }

  const next: PrivateRoomTable = table.seatAId === null ? { ...table, seatAId: playerId } : { ...table, seatBId: playerId }
  return { ok: true, state: { ...replaceTable(state, next), lastActivityAt: Date.now() } }
}

export type LeaveTableResult = { ok: true; state: PrivateRoomState } | { ok: false; reason: 'not_seated' | 'match_in_progress' }

/** item 43: 対戦開始前なら、座席からいつでも離れられる。 */
export function leaveTable(state: PrivateRoomState, playerId: string): LeaveTableResult {
  const table = findTableOf(state, playerId)
  if (!table) return { ok: false, reason: 'not_seated' }
  if (table.activeMatch) return { ok: false, reason: 'match_in_progress' }

  const next: PrivateRoomTable = {
    ...table,
    seatAId: table.seatAId === playerId ? null : table.seatAId,
    seatBId: table.seatBId === playerId ? null : table.seatBId,
    readyPlayerIds: [],
  }
  return { ok: true, state: { ...replaceTable(state, next), lastActivityAt: Date.now() } }
}

export type SetTableRulesResult = { ok: true; state: PrivateRoomState } | { ok: false; reason: 'not_seated_here' | 'match_in_progress' }

/**
 * item 43: TABLEに座った2人のうち、どちらでもルールを変更できる（ホストの許可は不要）。
 * 既存の指示どおり、ルール変更は必ずreadyPlayerIdsをリセットする——「片方がREADYの後に
 * もう片方が条件を変えた」まま対戦が始まってしまう事故を防ぐ。
 */
export function setTableRules(
  state: PrivateRoomState,
  playerId: string,
  tableId: number,
  battleType: BattleFormat,
  endlessDifficulty: EndlessDifficulty | null,
): SetTableRulesResult {
  const table = getTable(state, tableId)
  if (!table || (table.seatAId !== playerId && table.seatBId !== playerId)) return { ok: false, reason: 'not_seated_here' }
  if (table.activeMatch) return { ok: false, reason: 'match_in_progress' }

  const next: PrivateRoomTable = { ...table, battleType, endlessDifficulty: battleType === 'endless' ? endlessDifficulty : null, readyPlayerIds: [] }
  return { ok: true, state: replaceTable(state, next) }
}

export type SetTableReadyResult = { ok: true; state: PrivateRoomState } | { ok: false; reason: 'not_seated_here' | 'match_in_progress' }

/** item 43: READYの付け外し。両座席がREADYになったかどうかはbothSeatsReady()で別途判定する（DOラッパー側がstartTableMatchを呼ぶ判断に使う）。 */
export function setTableReady(state: PrivateRoomState, playerId: string, tableId: number, ready: boolean): SetTableReadyResult {
  const table = getTable(state, tableId)
  if (!table || (table.seatAId !== playerId && table.seatBId !== playerId)) return { ok: false, reason: 'not_seated_here' }
  if (table.activeMatch) return { ok: false, reason: 'match_in_progress' }

  const readyPlayerIds = ready ? Array.from(new Set([...table.readyPlayerIds, playerId])) : table.readyPlayerIds.filter((id) => id !== playerId)
  return { ok: true, state: replaceTable(state, { ...table, readyPlayerIds }) }
}

/** 両座席が埋まっていて、両方が現在のルールでREADY済みか。DOラッパーがこれをtrueと判定した瞬間にstartTableMatchを呼ぶ。 */
export function bothSeatsReady(table: PrivateRoomTable): boolean {
  if (!table.seatAId || !table.seatBId) return false
  return table.readyPlayerIds.includes(table.seatAId) && table.readyPlayerIds.includes(table.seatBId)
}

export type StartTableMatchResult = { ok: true; state: PrivateRoomState } | { ok: false; reason: 'not_ready' | 'match_in_progress' }

/**
 * item 43: 両座席がREADYになった瞬間、DOラッパーがmatchId（実際に生成するBattleRoom DOの
 * アドレス指定に使うID）を渡して呼ぶ。この純粋関数自体はBattleRoom DOの生成等は一切行わず、
 * ロビー状態の遷移だけを担当する（既存のbattle/battleRoomEngine.tsと同じ責務分離）。
 */
export function startTableMatch(state: PrivateRoomState, tableId: number, matchId: string): StartTableMatchResult {
  const table = getTable(state, tableId)
  if (!table || !table.seatAId || !table.seatBId) return { ok: false, reason: 'not_ready' }
  if (table.activeMatch) return { ok: false, reason: 'match_in_progress' }
  if (!bothSeatsReady(table)) return { ok: false, reason: 'not_ready' }

  const activeMatch: PrivateRoomActiveMatch = {
    matchId,
    battleType: table.battleType,
    endlessDifficulty: table.endlessDifficulty,
    memberAId: table.seatAId,
    memberBId: table.seatBId,
  }
  const next: PrivateRoomTable = { ...table, activeMatch, readyPlayerIds: [] }
  return { ok: true, state: { ...replaceTable(state, next), lastActivityAt: Date.now() } }
}

export interface ApplyMatchResultDetail {
  playerAFinalDopaPercent?: number
  playerBFinalDopaPercent?: number
  playerAStreak?: number
  playerBStreak?: number
}

/**
 * マッチ終了後、ルームスコープの簡易戦績（非永続、部屋が開いている間だけ）を反映し、
 * item 44の試合履歴フィードへ1件追加する。matchIdがいずれかのTABLEのactiveMatch.matchIdと
 * 一致する場合だけ適用し、一致しない（既に適用済み・別のマッチ）場合は何もしない——
 * 両メンバーが結果を各自報告しても二重加算されないべき等性ガード。
 */
export function applyMatchResult(
  state: PrivateRoomState,
  matchId: string,
  outcome: MatchOutcome,
  detail: ApplyMatchResultDetail,
  nowMs: number,
): PrivateRoomState {
  const table = state.tables.find((t) => t.activeMatch?.matchId === matchId)
  const active = table?.activeMatch
  if (!table || !active) return state

  const delta = {
    a: { aStat: 'wins' as const, bStat: 'losses' as const },
    b: { aStat: 'losses' as const, bStat: 'wins' as const },
    draw: { aStat: 'draws' as const, bStat: 'draws' as const },
  }[outcome]

  const members = state.members.map((m) => {
    if (m.playerId === active.memberAId) return { ...m, stats: { ...m.stats, [delta.aStat]: m.stats[delta.aStat] + 1 } }
    if (m.playerId === active.memberBId) return { ...m, stats: { ...m.stats, [delta.bStat]: m.stats[delta.bStat] + 1 } }
    return m
  })

  const entry: PrivateRoomMatchHistoryEntry = {
    matchId,
    tableId: table.tableId,
    finishedAt: nowMs,
    playerAId: active.memberAId,
    playerANickname: getMember(state, active.memberAId)?.profile.nickname ?? '?',
    playerBId: active.memberBId,
    playerBNickname: getMember(state, active.memberBId)?.profile.nickname ?? '?',
    winner: outcome,
    battleType: active.battleType,
    endlessDifficulty: active.endlessDifficulty,
    ...detail,
  }
  const matchHistory = [entry, ...state.matchHistory].slice(0, PRIVATE_ROOM_MATCH_HISTORY_CAP)

  const nextTable: PrivateRoomTable = { ...table, activeMatch: null }
  return { ...replaceTable({ ...state, members, matchHistory, lastActivityAt: nowMs }, nextTable) }
}

export function closeRoom(state: PrivateRoomState): PrivateRoomState {
  return { ...state, closed: true, tables: state.tables.map((t) => ({ ...t, activeMatch: null, readyPlayerIds: [] })) }
}

/** item 45: 最後の活動から6時間以上経過していれば期限切れ。アラームの発火だけに依存せず、アクセスのたびにこれで確認する。 */
export function isExpired(state: PrivateRoomState, nowMs: number): boolean {
  return nowMs - state.lastActivityAt > PRIVATE_ROOM_INACTIVITY_MS
}

/** item 45/46: 招待の送信も「意味のある操作」として扱う（WS経由でDOラッパーがこれを呼ぶ）。 */
export function touchActivity(state: PrivateRoomState, nowMs: number): PrivateRoomState {
  return { ...state, lastActivityAt: nowMs }
}

/**
 * 次フェーズ（item 137-141、大型最終仕上げラウンド）: SECRET「ドパガキ大集合」の判定条件
 * ——ルームがPRIVATE_ROOM_MAX_MEMBERS（8）人満員、かつ全TABLE（PRIVATE_ROOM_MAX_TABLES=4）が
 * 同時に対戦進行中（activeMatchがすべて非null）。単に8人入室しただけでは解除しない
 * （ユーザー指示）。PrivateRoomLobbyScreen.tsxがroom_state更新のたびに呼ぶ、
 * 状態を一切変更しない読み取り専用の純粋関数（テスト容易性のため分離）。
 */
export function isRoomFullHouseActive(state: PrivateRoomState): boolean {
  return state.members.length === PRIVATE_ROOM_MAX_MEMBERS && state.tables.every((t) => t.activeMatch !== null)
}

/**
 * 次フェーズ（item 137-141、大型最終仕上げラウンド）: SECRET「フレネミー」の判定条件——
 * 現在のルームの自分以外のメンバーがちょうど7人（＝ルームが満員）いて、そのメンバー
 * 全員に対してmatchHistory（新しい順、最大PRIVATE_ROOM_MATCH_HISTORY_CAP件）内で
 * 少なくとも1勝ずつ記録がある。同じ相手に複数回勝っても1人分としてのみ数える
 * （Setで重複排除）。
 */
export function hasBeatenAllOtherMembers(state: PrivateRoomState, playerId: string): boolean {
  const otherMemberIds = state.members.map((m) => m.playerId).filter((id) => id !== playerId)
  if (otherMemberIds.length !== PRIVATE_ROOM_MAX_MEMBERS - 1) return false
  const beatenIds = new Set(
    state.matchHistory
      .filter((h) => (h.playerAId === playerId && h.winner === 'a') || (h.playerBId === playerId && h.winner === 'b'))
      .map((h) => (h.playerAId === playerId ? h.playerBId : h.playerAId)),
  )
  return otherMemberIds.every((id) => beatenIds.has(id))
}
