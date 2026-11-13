import { compareDopaPerformance } from '../challenge/performance'
import { computeMedian } from '../challenge/performance'
import type { ChallengePerformance } from '../challenge/types'
import type { ChallengeProblemSetItem } from '../types'
import type { BattleAnswerEvent, BattleFinishReason, BattleFinishResult, BattleOpponentProfile, BattleWinner } from './types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: BattleRoom Durable Objectの試合状態を管理する
 * 純粋関数群。DurableObjectState・WebSocket等に一切依存しないため、vitestで直接テストできる
 * （Matchmakerと同じ「pure engine + 薄いDOラッパー」方針）。
 *
 * server authoritative方針（item 20）: 個々のanswerイベントは、サーバーが確定した
 * problemSet（各問題のtype/targetTimeMs）と照らして妥当性を検証したうえでしか記録しない
 * （存在しないquestionIndex・順序違反・重複・不可能なreaction time・bonusTime以外での
 * bonus申告・不可能なscore jumpを拒否）。最終的なaccuracy・maxCombo・
 * medianCorrectReactionMsの3項目は、クライアントの自己申告を一切信用せず、この検証済み
 * answerログだけから再計算する（Challengeより一段強いserver authoritative）。
 * finalDopaPercent・baseDopaPercentは、0〜120%（通常）と120〜200%（FINAL DOPA TRIAL）で
 * 根本的に異なる2つの進行式を完全にサーバー側で再現するのは今回のスコープ外のため、
 * クライアント自己申告値を「baseDopaPercent <= finalDopaPercent」「0〜200%の範囲内」という
 * 不変条件で検証する（Challengeのvalidation.tsと同じ思想の範囲検証）。
 */

const MAX_CORRECT_SCORE_DELTA = 20
const MIN_SCORE_DELTA = -25
const MAX_BONUS_GAIN_DELTA = 10
const REACTION_TIME_SLACK_MS = 2000
const DEFAULT_TARGET_TIME_MS = 5000
const MAX_BATTLE_PERCENT = 200

export type BattlePhase = 'waiting' | 'in_progress' | 'finished' | 'aborted'

export interface BattlePlayerSlot {
  playerId: string
  profile: BattleOpponentProfile
  connected: boolean
  ready: boolean
  disconnectedAt: number | null
  answers: BattleAnswerEvent[]
  nextExpectedQuestionIndex: number
  finished: boolean
  reportedPerformance: ChallengePerformance | null
  forfeited: boolean
}

export interface BattleRoomState {
  matchId: string
  mode: 'world' | 'friend'
  roomCode: string | null
  phase: BattlePhase
  problemSet: ChallengeProblemSetItem[]
  players: BattlePlayerSlot[]
  startAt: number | null
  finishReason: BattleFinishReason | null
  result: BattleFinishResult | null
}

function createSlot(playerId: string, profile: BattleOpponentProfile, connected: boolean): BattlePlayerSlot {
  return {
    playerId,
    profile,
    connected,
    ready: false,
    disconnectedAt: null,
    answers: [],
    nextExpectedQuestionIndex: 0,
    finished: false,
    reportedPerformance: null,
    forfeited: false,
  }
}

export function createRoom(
  matchId: string,
  mode: 'world' | 'friend',
  roomCode: string | null,
  problemSet: ChallengeProblemSetItem[],
): BattleRoomState {
  return { matchId, mode, roomCode, phase: 'waiting', problemSet, players: [], startAt: null, finishReason: null, result: null }
}

export function getPlayer(state: BattleRoomState, playerId: string): BattlePlayerSlot | undefined {
  return state.players.find((p) => p.playerId === playerId)
}

export function getOpponentOf(state: BattleRoomState, playerId: string): BattlePlayerSlot | undefined {
  return state.players.find((p) => p.playerId !== playerId)
}

export type AddPlayerResult = { ok: true; state: BattleRoomState } | { ok: false; reason: 'full' | 'ended' }

/**
 * world対戦はMatchmakerが既に2人を確定させてから部屋を作るため、両者がここで即時readyになる
 * （item 11: 「各端末がREADY後に勝手に3秒タイマーを始める方式は禁止」なので、ここではまだ
 * startAtを決めない。decideStartIfReady()が両者readyを見て初めて確定する）。
 * friend対戦はホストが作成直後に入室し、ゲストの合流を待つ（readyは別途markReadyで行う）。
 */
/**
 * connected（省略時true）: この呼び出しが実際のWebSocket接続確立の瞬間かどうか。
 * battleRoom.ts /internal/create（Matchmakerが世界対戦の2人を確定させた直後、両者の
 * 実ソケットがまだ1つも開いていない段階でのロスター事前登録）はfalseを渡す。
 * これをtrue固定にしてしまうと、片方の実WebSocketが先につながった瞬間に
 * decideStartIfReady()が「両者connected」と誤認し、まだつながっていない側へは
 * countdownを配信できないまま試合開始を確定してしまう（実際に踏んだ不具合）。
 */
export function addPlayer(
  state: BattleRoomState,
  playerId: string,
  profile: BattleOpponentProfile,
  autoReady: boolean,
  connected: boolean = true,
): AddPlayerResult {
  if (state.phase === 'finished' || state.phase === 'aborted') return { ok: false, reason: 'ended' }
  const existing = getPlayer(state, playerId)
  if (existing) {
    const players = state.players.map((p) => (p.playerId === playerId ? { ...p, connected: true, disconnectedAt: null } : p))
    return { ok: true, state: { ...state, players } }
  }
  if (state.players.length >= 2) return { ok: false, reason: 'full' }
  const slot = createSlot(playerId, profile, connected)
  if (autoReady) slot.ready = true
  return { ok: true, state: { ...state, players: [...state.players, slot] } }
}

export function removePlayerBeforeStart(state: BattleRoomState, playerId: string): BattleRoomState {
  if (state.phase !== 'waiting') return state
  return { ...state, players: state.players.filter((p) => p.playerId !== playerId) }
}

export function markReady(state: BattleRoomState, playerId: string): BattleRoomState {
  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, ready: true } : p))
  return { ...state, players }
}

/**
 * item 11（対戦開始同期）: 両者がconnectedかつreadyになった時点でだけ、サーバーがstartAtを
 * 一度だけ確定する（既に決まっていれば何もしない＝冪等）。countdownMsは両クライアントが
 * 3→2→1→STARTの表示に使う猶予（既存の演出時間に合わせて呼び出し側が指定する）。
 */
export function decideStartIfReady(state: BattleRoomState, nowMs: number, countdownMs: number): BattleRoomState {
  if (state.phase !== 'waiting' || state.startAt !== null) return state
  if (state.players.length !== 2) return state
  if (!state.players.every((p) => p.connected && p.ready)) return state
  return { ...state, phase: 'in_progress', startAt: nowMs + countdownMs }
}

export type SubmitAnswerResult = { ok: true; state: BattleRoomState } | { ok: false; reason: string }

/**
 * item 20/21（server authoritative・不正イベント検知）。
 * 拒否条件: 試合が進行中でない / 存在しないquestionIndex / 順序違反・重複（次に期待する
 * indexと不一致） / 不可能なreaction time（0未満、またはその問題のtargetTimeMs+slackを超える） /
 * 不可能なscore jump（妥当範囲外） / bonusTime以外の問題でのbonus申告。
 */
export function submitAnswer(state: BattleRoomState, playerId: string, event: BattleAnswerEvent): SubmitAnswerResult {
  if (state.phase !== 'in_progress') return { ok: false, reason: 'match not in progress' }
  const player = getPlayer(state, playerId)
  if (!player) return { ok: false, reason: 'unknown player' }
  if (player.finished) return { ok: false, reason: 'player already finished' }
  if (event.questionIndex !== player.nextExpectedQuestionIndex) {
    return { ok: false, reason: 'questionIndex out of order or duplicate' }
  }
  const problem = state.problemSet[event.questionIndex]
  if (!problem) return { ok: false, reason: 'questionIndex does not exist' }
  if (event.reactionMs < 0 || event.reactionMs > (problem.targetTimeMs ?? DEFAULT_TARGET_TIME_MS) + REACTION_TIME_SLACK_MS) {
    return { ok: false, reason: 'implausible reaction time' }
  }
  if (event.scoreDelta < MIN_SCORE_DELTA || event.scoreDelta > MAX_CORRECT_SCORE_DELTA) {
    return { ok: false, reason: 'implausible score jump' }
  }
  if (problem.type !== 'bonusTime' && event.bonusGainDelta !== 0) {
    return { ok: false, reason: 'bonus gain reported on a non-bonus question' }
  }
  if (event.bonusGainDelta < 0 || event.bonusGainDelta > MAX_BONUS_GAIN_DELTA) {
    return { ok: false, reason: 'implausible bonus gain' }
  }

  const players = state.players.map((p) =>
    p.playerId === playerId ? { ...p, answers: [...p.answers, event], nextExpectedQuestionIndex: p.nextExpectedQuestionIndex + 1 } : p,
  )
  return { ok: true, state: { ...state, players } }
}

export type SubmitFinishedResult = { state: BattleRoomState; bothFinished: boolean }

export function submitFinished(state: BattleRoomState, playerId: string, performance: ChallengePerformance): SubmitFinishedResult {
  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, finished: true, reportedPerformance: performance } : p))
  const nextState = { ...state, players }
  return { state: nextState, bothFinished: players.every((p) => p.finished || p.forfeited) }
}

export function applyForfeit(state: BattleRoomState, playerId: string): BattleRoomState {
  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, forfeited: true } : p))
  return { ...state, players }
}

export function applyDisconnect(state: BattleRoomState, playerId: string, nowMs: number): BattleRoomState {
  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, connected: false, disconnectedAt: nowMs } : p))
  return { ...state, players }
}

export function applyReconnect(state: BattleRoomState, playerId: string): BattleRoomState {
  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, connected: true, disconnectedAt: null } : p))
  return { ...state, players }
}

/** item 23（切断）: 試合開始後の切断から5秒（graceMs）経過したら切断側LOSE確定。 */
export function isDisconnectTimedOut(player: BattlePlayerSlot, nowMs: number, graceMs: number): boolean {
  return player.disconnectedAt !== null && nowMs - player.disconnectedAt >= graceMs
}

function recomputeAuthoritativePerformance(player: BattlePlayerSlot): ChallengePerformance {
  const correct = player.answers.filter((a) => a.correct)
  const totalAnswered = player.answers.length
  const accuracy = totalAnswered > 0 ? correct.length / totalAnswered : 0

  // accuracy/maxCombo/medianCorrectReactionMsはanswerログから100%サーバー側で再計算する
  // （クライアントの自己申告を一切信用しない）。
  let maxCombo = 0
  let runningCombo = 0
  for (const a of player.answers) {
    runningCombo = a.correct ? runningCombo + 1 : 0
    if (runningCombo > maxCombo) maxCombo = runningCombo
  }
  const medianCorrectReactionMs = computeMedian(correct.map((a) => a.reactionMs))

  // finalDopaPercent/baseDopaPercentは、0〜200%の2段階スコア式を完全にサーバー側で
  // 再現するのは今回スコープ外のため、クライアント自己申告値を不変条件
  // （範囲0〜200・base<=final）だけで検証する。
  const reported = player.reportedPerformance
  const finalDopaPercent = reported ? Math.min(Math.max(0, reported.finalDopaPercent), MAX_BATTLE_PERCENT) : 0
  const baseDopaPercent = reported ? Math.min(Math.max(0, reported.baseDopaPercent), finalDopaPercent) : 0

  return { finalDopaPercent, baseDopaPercent, accuracy, maxCombo, medianCorrectReactionMs }
}

/**
 * 両者finished（またはforfeit/disconnect timeout）に達した時点で呼ぶ。勝敗はdraw対応版の
 * compareDopaPerformanceをそのまま使う（Challengeの比較ロジックと完全に共有）。
 */
export function finalizeResult(state: BattleRoomState): BattleFinishResult {
  const [playerA, playerB] = state.players
  if (!playerA || !playerB) {
    const emptyPerformance: ChallengePerformance = { finalDopaPercent: 0, baseDopaPercent: 0, accuracy: 0, maxCombo: 0, medianCorrectReactionMs: null }
    return {
      winner: 'draw',
      decidedBy: null,
      finishReason: 'invalid',
      playerA: { performance: playerA ? recomputeAuthoritativePerformance(playerA) : emptyPerformance },
      playerB: { performance: playerB ? recomputeAuthoritativePerformance(playerB) : emptyPerformance },
    }
  }
  const forfeitedA = playerA.forfeited
  const forfeitedB = playerB?.forfeited ?? false
  const disconnectedA = playerA ? !playerA.connected : false
  const disconnectedB = playerB ? !playerB.connected : false

  if (forfeitedA || forfeitedB || disconnectedA || disconnectedB) {
    const aLoses = forfeitedA || disconnectedA
    const bLoses = forfeitedB || disconnectedB
    const finalWinner: BattleWinner = aLoses && bLoses ? 'draw' : aLoses ? 'playerB' : 'playerA'
    const finishReason: BattleFinishReason = forfeitedA || forfeitedB ? 'forfeit' : 'disconnect'
    return {
      winner: finalWinner,
      decidedBy: null,
      finishReason,
      playerA: { performance: recomputeAuthoritativePerformance(playerA) },
      playerB: { performance: recomputeAuthoritativePerformance(playerB) },
    }
  }

  const perfA = recomputeAuthoritativePerformance(playerA)
  const perfB = recomputeAuthoritativePerformance(playerB)
  const comparison = compareDopaPerformance(perfA, perfB)
  const winner: BattleWinner = comparison.winner === 'a' ? 'playerA' : comparison.winner === 'b' ? 'playerB' : 'draw'
  return {
    winner,
    decidedBy: comparison.decidedBy,
    finishReason: 'completed',
    playerA: { performance: perfA },
    playerB: { performance: perfB },
  }
}
