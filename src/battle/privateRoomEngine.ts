import type { BattleFormat, BattleOpponentProfile } from './types'
import type { EndlessDifficulty } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOM（ロビー）の
 * Durable Object内部状態を管理する純粋関数群。battle/battleRoomEngine.tsと同じ
 * 「pure engine + 薄いDOラッパー」方針（DurableObjectState・WebSocket等に一切依存しない
 * ため、vitestで直接テストできる）。
 *
 * コーディネーターからの明示指示: room formatは'FREE'を今すぐ実装するが、将来
 * 'LEAGUE'/'TOURNAMENT'も追加できる拡張可能な設計にする（1v1単一形式専用の設計にしない）。
 * そのため、PrivateRoomFormatをunion型にしておく（今回のリテラルは'FREE'の1つだけだが、
 * 将来の追加はこの型への1行追加＋新しい分岐の追加だけで済み、既存のFREE専用ロジックを
 * 書き換える必要がない）。
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

/** 現在進行中のマッチ（ホストが選んだ2人によるNORMAL/ENDLESS対戦）。同時に1件のみ存在できる。 */
export interface PrivateRoomActiveMatch {
  matchId: string
  battleType: BattleFormat
  endlessDifficulty: EndlessDifficulty | null
  memberAId: string
  memberBId: string
}

export interface PrivateRoomState {
  roomCode: string
  format: PrivateRoomFormat
  hostPlayerId: string
  members: PrivateRoomMember[]
  activeMatch: PrivateRoomActiveMatch | null
  closed: boolean
  createdAt: number
}

function createMember(playerId: string, profile: BattleOpponentProfile, connected: boolean): PrivateRoomMember {
  return { playerId, profile, connected, stats: { wins: 0, losses: 0, draws: 0 } }
}

export function createPrivateRoomState(roomCode: string, hostPlayerId: string, hostProfile: BattleOpponentProfile, nowMs: number): PrivateRoomState {
  return {
    roomCode,
    format: 'FREE',
    hostPlayerId,
    members: [createMember(hostPlayerId, hostProfile, false)],
    activeMatch: null,
    closed: false,
    createdAt: nowMs,
  }
}

export function getMember(state: PrivateRoomState, playerId: string): PrivateRoomMember | undefined {
  return state.members.find((m) => m.playerId === playerId)
}

export type AddMemberResult = { ok: true; state: PrivateRoomState } | { ok: false; reason: 'closed' | 'full' }

/**
 * 部屋への合流（item: JOINING a private room is free for everyone）。既存メンバーの
 * 再合流（切断後の再接続）はconnected=trueに戻すだけで、満員判定の対象にしない
 * （既にロスターに居る＝既存の1席を使っているだけのため）。
 */
export function addMember(state: PrivateRoomState, playerId: string, profile: BattleOpponentProfile): AddMemberResult {
  if (state.closed) return { ok: false, reason: 'closed' }
  const existing = getMember(state, playerId)
  if (existing) {
    const members = state.members.map((m) => (m.playerId === playerId ? { ...m, connected: true, profile } : m))
    return { ok: true, state: { ...state, members } }
  }
  if (state.members.length >= PRIVATE_ROOM_MAX_MEMBERS) return { ok: false, reason: 'full' }
  return { ok: true, state: { ...state, members: [...state.members, createMember(playerId, profile, true)] } }
}

export function setMemberConnected(state: PrivateRoomState, playerId: string, connected: boolean): PrivateRoomState {
  const members = state.members.map((m) => (m.playerId === playerId ? { ...m, connected } : m))
  return { ...state, members }
}

export type StartMatchResult =
  | { ok: true; state: PrivateRoomState }
  | { ok: false; reason: 'not_host' | 'closed' | 'match_in_progress' | 'member_not_found' | 'same_member' }

/**
 * ホストが2人を選んで実際の1v1マッチを開始する（lobby = 複数人が集まる場所、
 * そこからホストが都度2人を選んで対戦させる、というユーザー指示の中核）。
 * 実際のBattleRoom DO生成（既存の1v1エンジン再利用）はこのDOのラッパー側が行う
 * ——この純粋関数はロビー状態の検証・遷移だけを担当する。
 */
export function startMatch(
  state: PrivateRoomState,
  requesterId: string,
  memberAId: string,
  memberBId: string,
  matchId: string,
  battleType: BattleFormat,
  endlessDifficulty: EndlessDifficulty | null,
): StartMatchResult {
  if (requesterId !== state.hostPlayerId) return { ok: false, reason: 'not_host' }
  if (state.closed) return { ok: false, reason: 'closed' }
  if (state.activeMatch) return { ok: false, reason: 'match_in_progress' }
  if (memberAId === memberBId) return { ok: false, reason: 'same_member' }
  if (!getMember(state, memberAId) || !getMember(state, memberBId)) return { ok: false, reason: 'member_not_found' }
  const activeMatch: PrivateRoomActiveMatch = { matchId, battleType, endlessDifficulty, memberAId, memberBId }
  return { ok: true, state: { ...state, activeMatch } }
}

export type MatchOutcome = 'a' | 'b' | 'draw'

/**
 * マッチ終了後、ルームスコープの簡易戦績（非永続、部屋が開いている間だけ）を反映する。
 * matchIdがstate.activeMatch.matchIdと一致する場合だけ適用し、一致しない（既に適用済み・
 * 別のマッチ）場合は何もしない——両メンバーが結果を各自報告しても二重加算されない
 * べき等性ガード。
 */
export function applyMatchResult(state: PrivateRoomState, matchId: string, outcome: MatchOutcome): PrivateRoomState {
  const active = state.activeMatch
  if (!active || active.matchId !== matchId) return state

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

  return { ...state, members, activeMatch: null }
}

/** ホストがマッチを中断した場合など、結果を確定させずにロビーへ戻す（戦績は加算しない）。 */
export function cancelActiveMatch(state: PrivateRoomState): PrivateRoomState {
  return { ...state, activeMatch: null }
}

export function closeRoom(state: PrivateRoomState): PrivateRoomState {
  return { ...state, closed: true, activeMatch: null }
}
