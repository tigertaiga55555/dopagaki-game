import { compareDopaPerformance, compareEndlessStreak } from '../challenge/performance'
import { computeMedian } from '../challenge/performance'
import type { ChallengePerformance } from '../challenge/types'
import type { ChallengeProblemSetItem } from '../types'
import type {
  BattleAnswerEvent,
  BattleFinishReason,
  BattleFinishResult,
  BattleFormat,
  BattleOpponentProfile,
  BattleWinner,
  EndlessBattleFinishResult,
} from './types'

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
  /** 次フェーズ（item 15）: ENDLESS形式専用。進行中のライブSTREAK（UI表示用、確定前）。 */
  liveStreak: number
  /** 次フェーズ（item 15）: ENDLESS形式専用。MISSして確定したSTREAK。未確定はnull。 */
  finalStreak: number | null
}

export interface BattleRoomState {
  matchId: string
  mode: 'world' | 'friend'
  roomCode: string | null
  phase: BattlePhase
  /** 次フェーズ（item 15）: 既存のWorld/Friend Battleは常に'normal'（デフォルト、動作は一切変更しない）。PRIVATE ROOMのENDLESS対戦だけ'endless'。 */
  battleType: BattleFormat
  problemSet: ChallengeProblemSetItem[]
  players: BattlePlayerSlot[]
  startAt: number | null
  finishReason: BattleFinishReason | null
  result: BattleFinishResult | null
  /** 次フェーズ（item 15）: battleType==='endless'の確定結果。normal形式では常にnull（resultと排他）。 */
  endlessResult: EndlessBattleFinishResult | null
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
    liveStreak: 0,
    finalStreak: null,
  }
}

export function createRoom(
  matchId: string,
  mode: 'world' | 'friend',
  roomCode: string | null,
  problemSet: ChallengeProblemSetItem[],
  battleType: BattleFormat = 'normal',
): BattleRoomState {
  return {
    matchId,
    mode,
    roomCode,
    phase: 'waiting',
    battleType,
    problemSet,
    players: [],
    startAt: null,
    finishReason: null,
    result: null,
    endlessResult: null,
  }
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

export interface CountdownPayload {
  startAt: number
  problemSet: ChallengeProblemSetItem[]
  opponent: BattleOpponentProfile
}

/**
 * 次フェーズ（世界対戦countdown(B) timeoutの根治）: 試合が既にin_progress（startAt確定済み）
 * なら、そのプレイヤーへ今すぐ送るべきcountdown payloadを返す（まだなら null）。
 *
 * 根本原因の調査で判明した事実: 旧実装はmaybeStartCountdown()が「startAtをちょうど
 * 今決めた瞬間」にだけ、ctx.getWebSockets()経由のソケット検索（socketFor）で両者へ
 * 一度だけbroadcastしていた。しかし、2人目（例: Player B）はまさにこの決定を引き起こした
 * 本人であり、その本人のWebSocketは同じリクエストハンドラ内でctx.acceptWebSocket()に
 * よって「たった今」acceptされたばかりのソケットである。ctx.getWebSockets()がこの
 * ソケットを検索可能な一覧へ反映するタイミングと、同一関数内でのその後すぐの検索
 * （await解決後）の間に、何らかの遅延（内部的な登録の確定が次のmicrotask/tick跨ぎになる
 * 等）が万一あれば、socketForはこの「自分自身の、たった今acceptしたソケット」をnullで
 * 返し、this.send()が黒く失敗せず（エラーなし）メッセージを静かに取り落とす
 * （private send()の`if (!ws) return`仕様）。これは常に「後から接続した側＝今まさにその
 * リクエストを処理している本人」でだけ起こり得る非対称な取り落としであり、既に別の
 * （完了済みの）リクエストで確立されていたA側のソケット検索は毎回確実に成功するため、
 * 観測された「countdown(B)だけが繰り返しtimeoutする」という非対称なパターンと一致する。
 *
 * この関数はdecidedの判定を一切行わず（decideStartIfReady専任）、「今の状態がすでに
 * in_progressなら、このプレイヤー向けのcountdown payloadをそのまま返す」という復元
 * （state restoration）だけに専念する。呼び出し側（battleRoom.ts）は、
 * (1) maybeStartCountdown()による既存のbroadcast（対戦相手など、既に確立済みの別ソケットへの
 * 配信には今まで通り確実に機能する）はそのまま維持しつつ、
 * (2) handleWebSocketUpgrade側で「たった今acceptしたローカルのWebSocketオブジェクト参照」へ
 * 直接この関数の戻り値を送ることで、ctx.getWebSockets()のソケット検索を一切経由しない
 * 確実な配信経路を追加する。
 * これは同時に「試合開始後に切断→再接続したプレイヤーへcountdownが再配信されない」という
 * 別の既存ギャップ（旧実装はdecideStartIfReadyが一度startAtを確定した後は
 * `state.startAt !== before`が常にfalseになるため、再接続時に一切再送されなかった）も
 * 同じ経路で自然に解消する——再接続時もこの関数は一貫してcountdown payloadを返すため、
 * サーバーの状態（startAt／problem_set）を正とした復元が常に効く。
 *
 * 冪等性（item 6: 二重countdown・二重STARTなし）: クライアント側（BattleMatchScreen.tsx）は
 * 受信したstartAt/problemSetをただのReact stateとして設定するだけなので、同一の値を
 * 複数回受信しても追加の副作用は発生しない（値が変化しない限りuseEffectは再実行されない）。
 * そのため、既存のbroadcastとこの直接送信が同じ相手へ重複して届いても安全である。
 */
export function buildCountdownPayloadFor(state: BattleRoomState, playerId: string): CountdownPayload | null {
  if (state.phase !== 'in_progress' || state.startAt === null) return null
  const opponent = getOpponentOf(state, playerId)
  if (!opponent) return null
  return { startAt: state.startAt, problemSet: state.problemSet, opponent: opponent.profile }
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

/**
 * 次フェーズ（item 15）: ENDLESS形式専用。進行中のライブSTREAK報告（相手への表示用、まだ
 * 確定していない）。answer/progressのDOPA%ベースの検証（questionIndex順序・score範囲等）は
 * ENDLESSには存在しない概念のため、ここでは一切行わない——streak自体はクライアントの
 * endlessEngine.tsが既に検証済みの「何連続正解したか」という単純な整数であり、Battleの
 * answerイベントのような不正値検証対象ではない（最終勝敗はfinalStreak同士の比較だけで
 * 決まり、途中経過のliveStreakは表示用に過ぎない）。
 */
export function submitEndlessProgress(state: BattleRoomState, playerId: string, streak: number): BattleRoomState {
  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, liveStreak: Math.max(0, streak) } : p))
  return { ...state, players }
}

export type SubmitEndlessFinishedResult = { state: BattleRoomState; bothFinished: boolean }

/** 次フェーズ（item 15）: ENDLESS形式専用。1プレイヤーがMISSして確定STREAKを報告した。 */
export function submitEndlessFinished(state: BattleRoomState, playerId: string, streak: number): SubmitEndlessFinishedResult {
  const finalStreak = Math.max(0, streak)
  const players = state.players.map((p) =>
    p.playerId === playerId ? { ...p, finished: true, finalStreak, liveStreak: finalStreak } : p,
  )
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

/**
 * 次フェーズ（item 15）: ENDLESS形式専用のfinalize。finalizeResult()と同じ
 * forfeit/disconnect優先ルールを踏襲しつつ、勝敗の決定だけを既存のcompareEndlessStreak
 * （ENDLESS Challengeで実績のある、タイブレーク一切なしの単純STREAK比較）に委ねる
 * ——DOPA%比較ロジック（compareDopaPerformance）は一切参照しない。
 * compareEndlessStreak(host, challenger)はchallenger視点の結果を返すため、playerAを
 * host役・playerBをchallenger役として呼び、戻り値をBattleWinnerへ読み替える。
 */
export function finalizeEndlessResult(state: BattleRoomState): EndlessBattleFinishResult {
  const [playerA, playerB] = state.players
  if (!playerA || !playerB) {
    return { winner: 'draw', finishReason: 'invalid', playerAStreak: playerA?.finalStreak ?? 0, playerBStreak: playerB?.finalStreak ?? 0 }
  }
  const forfeitedA = playerA.forfeited
  const forfeitedB = playerB.forfeited
  const disconnectedA = !playerA.connected
  const disconnectedB = !playerB.connected

  if (forfeitedA || forfeitedB || disconnectedA || disconnectedB) {
    const aLoses = forfeitedA || disconnectedA
    const bLoses = forfeitedB || disconnectedB
    const winner: BattleWinner = aLoses && bLoses ? 'draw' : aLoses ? 'playerB' : 'playerA'
    const finishReason: BattleFinishReason = forfeitedA || forfeitedB ? 'forfeit' : 'disconnect'
    return { winner, finishReason, playerAStreak: playerA.finalStreak ?? 0, playerBStreak: playerB.finalStreak ?? 0 }
  }

  const streakA = playerA.finalStreak ?? 0
  const streakB = playerB.finalStreak ?? 0
  const comparison = compareEndlessStreak(streakA, streakB)
  const winner: BattleWinner = comparison === 'win' ? 'playerB' : comparison === 'lose' ? 'playerA' : 'draw'
  return { winner, finishReason: 'completed', playerAStreak: streakA, playerBStreak: streakB }
}
