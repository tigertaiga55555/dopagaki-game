import type { AvatarRef, ChallengeProblemSetItem, TitleId } from '../types'
import type { ChallengeDecidedBy, ChallengePerformance } from '../challenge/types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: クライアント（WebSocket接続側）とWorker/Durable
 * Object（src/worker/durableObjects/）の両方から参照する、Battle機能の共有型定義。
 *
 * ChallengePerformance・ChallengeDecidedBy・ChallengeProblemSetItemはそのまま再利用する
 * （同じ概念にBattle専用の別フィールド名を作らない、というユーザー指示）。
 */
export type { ChallengeProblemSetItem }

export type BattleMode = 'world' | 'friend'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15）: BattleRoom（1試合ぶんのDurable Object）が
 * 内部で管理する試合種別。'normal'は既存のDOPA%ベース（0〜200%）の1v1、'endless'は
 * PRIVATE ROOM専用の新しい種別——同じ問題列を両者が独立に解き、片方がMISSしても
 * もう片方が記録を超える可能性がある限り続行し、最終STREAKを比較する
 * （既存のENDLESS ChallengeのcompareEndlessStreakをそのまま再利用、DOPA%比較ロジックは
 * 一切流用しない）。既存のWorld/Friend Battle（createRoom呼び出し）は常に'normal'のまま、
 * 挙動に一切変化がない。
 */
export type BattleFormat = 'normal' | 'endless'

/** Challengeと異なり、全項目完全同値はDRAW（どちらのLOSEでもない）。 */
export type BattleWinner = 'playerA' | 'playerB' | 'draw'

/** decidedByの意味はChallengeと完全に同じ（優先順位の同じ5指標＋完全同値）。 */
export type BattleDecidedBy = ChallengeDecidedBy

/** 対戦相手として画面に表示する最小限のプロフィール情報。playerId自体はUIに出さない。 */
export interface BattleOpponentProfile {
  nickname: string
  avatar: AvatarRef
  equippedTitleId: TitleId | null
}

export type BattleFinishReason = 'completed' | 'forfeit' | 'disconnect' | 'invalid'

export interface BattlePlayerResult {
  performance: ChallengePerformance
}

export interface BattleFinishResult {
  winner: BattleWinner
  decidedBy: BattleDecidedBy | null
  finishReason: BattleFinishReason
  playerA: BattlePlayerResult
  playerB: BattlePlayerResult
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15）: ENDLESS形式（PRIVATE ROOM専用）の結果。
 * 既存のBattleFinishResult（DOPA%/正答率/COMBO/反応速度ベース）とは完全に別の型にして、
 * 既存のBattleResultScreen.tsx（normal形式専用、World/Friend Battleで実績あり）を
 * 一切変更しない。decidedByという概念自体が存在しない（STREAK比較だけ、タイブレークなし）。
 */
export interface EndlessBattleFinishResult {
  winner: BattleWinner
  finishReason: BattleFinishReason
  playerAStreak: number
  playerBStreak: number
}

/**
 * Ver.6 Phase 6: 1問ぶんの回答イベント。クライアントが送信し、BattleRoom側で
 * 検証・蓄積する（item 20: server authoritative）。scoreDelta/bonusGainDeltaは
 * そのクライアントのローカルengine（useRushGame等、既存の単機プレイと全く同じ
 * ロジック）が計算した値を送るだけで、Battle専用の別スコア計算を作らない。
 * サーバー側は個々の値を妥当な範囲内かどうかだけ検証し、そこから独自に積算する
 * （最終的な自己申告の集計値をそのまま信用しない）。
 */
export interface BattleAnswerEvent {
  questionIndex: number
  correct: boolean
  reactionMs: number
  scoreDelta: number
  bonusGainDelta: number
}

/** WebSocket message schema（将来の後方互換のためversionフィールドを持つ）。 */
export const BATTLE_PROTOCOL_VERSION = 1

interface BaseMessage {
  v: typeof BATTLE_PROTOCOL_VERSION
}

/**
 * ルーム作成（POST /api/battles/rooms）・ルーム状態確認（GET /api/battles/rooms/:roomCode）は
 * 通常のHTTP REST（まだWebSocket接続が存在しない段階のため）。実際の対戦（マッチング完了後・
 * ルーム合流後）だけがWebSocketメッセージになる。
 */
export type BattleClientMessage =
  | (BaseMessage & { type: 'join_world_queue' })
  | (BaseMessage & { type: 'cancel_world_queue' })
  | (BaseMessage & { type: 'ready' })
  | (BaseMessage & { type: 'answer' } & BattleAnswerEvent)
  | (BaseMessage & { type: 'progress'; percent: number })
  | (BaseMessage & { type: 'finished'; performance: ChallengePerformance })
  | (BaseMessage & { type: 'forfeit' })
  // 次フェーズ（DOPA PASS基盤ラウンド、item 15）: ENDLESS形式（PRIVATE ROOM専用）専用の2種。
  // 既存のanswer/progress/finishedはDOPA%ベースのため使わず、STREAK数だけをやり取りする。
  | (BaseMessage & { type: 'endless_progress'; streak: number })
  | (BaseMessage & { type: 'endless_finished'; streak: number })

export type BattleServerMessage =
  | (BaseMessage & { type: 'queue_joined' })
  | (BaseMessage & { type: 'queue_timeout' })
  | (BaseMessage & { type: 'match_found'; matchId: string; opponent: BattleOpponentProfile })
  | (BaseMessage & { type: 'opponent_joined'; opponent: BattleOpponentProfile })
  | (BaseMessage & { type: 'countdown'; startAt: number; problemSet: ChallengeProblemSetItem[]; opponent: BattleOpponentProfile })
  | (BaseMessage & { type: 'opponent_progress'; percent: number })
  | (BaseMessage & { type: 'opponent_disconnected'; graceMs: number })
  | (BaseMessage & { type: 'opponent_reconnected' })
  | (BaseMessage & { type: 'battle_finish'; result: BattleFinishResult; viewerIsPlayerA: boolean })
  | (BaseMessage & { type: 'error'; message: string })
  | (BaseMessage & { type: 'opponent_endless_progress'; streak: number })
  | (BaseMessage & { type: 'endless_battle_finish'; result: EndlessBattleFinishResult; viewerIsPlayerA: boolean })

export interface CreateRoomResponse {
  roomCode: string
  matchId: string
}

export type RoomStatusResponse =
  | { ok: true; hostProfile: BattleOpponentProfile }
  | { ok: false; reason: 'not_found' | 'full' | 'ended' }

/** 任意JSONをそのまま信用しない（src/worker/validation.tsと同じ方針）。形だけの最小検証。 */
export function isBattleClientMessage(raw: unknown): raw is BattleClientMessage {
  if (typeof raw !== 'object' || raw === null) return false
  const msg = raw as Partial<BattleClientMessage>
  if (msg.v !== BATTLE_PROTOCOL_VERSION) return false
  if (typeof (msg as { type?: unknown }).type !== 'string') return false
  return true
}
