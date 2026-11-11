import type { BattleOpponentProfile } from './types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: Matchmaker Durable Objectの待機列を管理する
 * 純粋関数群。DurableObjectState・WebSocket等のランタイムAPIに一切依存しないため、
 * vitestで実際のCloudflareランタイムなしに直接テストできる（既存のchallenge500Engine.ts
 * 等と同じ「pure engine + 薄いDOラッパー」方針）。
 *
 * レーティングは使わず単純な先着順（ユーザー指示）。CPU・偽プレイヤーは一切混ぜない。
 */
export interface QueueEntry {
  playerId: string
  profile: BattleOpponentProfile
  joinedAt: number
}

export interface MatchmakerState {
  queue: QueueEntry[]
}

export function createMatchmakerState(): MatchmakerState {
  return { queue: [] }
}

/** 同一playerIdが既に待機中なら、新しいentry（joinedAt更新）で置き換える（重複登録を防ぐ）。 */
export function enqueue(state: MatchmakerState, entry: QueueEntry): MatchmakerState {
  const filtered = state.queue.filter((e) => e.playerId !== entry.playerId)
  return { queue: [...filtered, entry] }
}

export function dequeue(state: MatchmakerState, playerId: string): MatchmakerState {
  return { queue: state.queue.filter((e) => e.playerId !== playerId) }
}

export function isQueued(state: MatchmakerState, playerId: string): boolean {
  return state.queue.some((e) => e.playerId === playerId)
}

export interface MatchPair {
  a: QueueEntry
  b: QueueEntry
}

export interface TryMatchResult {
  pair: MatchPair
  state: MatchmakerState
}

/**
 * 先頭2人を組ませ、両者を待機列から同時に取り除く（1回の同期関数呼び出しで完結するため、
 * 同じplayerが同時に複数試合へ割り当てられる余地が無い）。2人未満ならnull。
 */
export function tryMatch(state: MatchmakerState): TryMatchResult | null {
  if (state.queue.length < 2) return null
  const [a, b, ...rest] = state.queue
  return { pair: { a, b }, state: { queue: rest } }
}

/** 15秒以上待っているentryを抽出する（timeout通知の対象）。 */
export function findTimedOut(state: MatchmakerState, nowMs: number, timeoutMs: number): QueueEntry[] {
  return state.queue.filter((e) => nowMs - e.joinedAt >= timeoutMs)
}
