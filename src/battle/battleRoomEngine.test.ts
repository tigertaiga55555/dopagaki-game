import { describe, expect, it } from 'vitest'
import {
  addPlayer,
  applyDisconnect,
  applyForfeit,
  applyReconnect,
  createRoom,
  decideStartIfReady,
  finalizeResult,
  isDisconnectTimedOut,
  markReady,
  removePlayerBeforeStart,
  submitAnswer,
  submitFinished,
  type BattleRoomState,
} from './battleRoomEngine'
import type { BattleAnswerEvent, BattleOpponentProfile } from './types'
import type { ChallengeProblemSetItem } from '../types'
import type { ChallengePerformance } from '../challenge/types'

const PROFILE_A: BattleOpponentProfile = { nickname: 'A', avatar: { kind: 'preset', iconId: 'star' }, equippedTitleId: null }
const PROFILE_B: BattleOpponentProfile = { nickname: 'B', avatar: { kind: 'preset', iconId: 'flame' }, equippedTitleId: null }

function sampleProblemSet(length = 5): ChallengeProblemSetItem[] {
  return Array.from({ length }, (_, i) => ({ type: i === 2 ? 'bonusTime' : 'color', targetTimeMs: 1000, data: {} }))
}

function answer(overrides: Partial<BattleAnswerEvent> = {}): BattleAnswerEvent {
  return { questionIndex: 0, correct: true, reactionMs: 500, scoreDelta: 4, bonusGainDelta: 0, ...overrides }
}

function performance(overrides: Partial<ChallengePerformance> = {}): ChallengePerformance {
  return { finalDopaPercent: 80, baseDopaPercent: 80, accuracy: 0.8, maxCombo: 5, medianCorrectReactionMs: 500, ...overrides }
}

describe('battleRoomEngine: room lifecycle (Ver.6 Phase 6)', () => {
  it('world対戦: addPlayerにautoReady=trueを渡すと即readyになる', () => {
    let state = createRoom('m1', 'world', null, sampleProblemSet())
    const result = addPlayer(state, 'a', PROFILE_A, true)
    expect(result.ok).toBe(true)
    state = (result as { ok: true; state: BattleRoomState }).state
    expect(state.players[0].ready).toBe(true)
  })

  it('friend対戦: autoReady=falseでは明示的なmarkReadyが必要', () => {
    let state = createRoom('m1', 'friend', 'ABCDEF', sampleProblemSet())
    const result = addPlayer(state, 'a', PROFILE_A, false)
    state = (result as { ok: true; state: BattleRoomState }).state
    expect(state.players[0].ready).toBe(false)
    state = markReady(state, 'a')
    expect(state.players[0].ready).toBe(true)
  })

  it('3人目の参加はfullエラーになる（同一ルームは2人まで）', () => {
    let state = createRoom('m1', 'friend', 'ABCDEF', sampleProblemSet())
    state = (addPlayer(state, 'a', PROFILE_A, false) as { ok: true; state: BattleRoomState }).state
    state = (addPlayer(state, 'b', PROFILE_B, false) as { ok: true; state: BattleRoomState }).state
    const third = addPlayer(state, 'c', PROFILE_A, false)
    expect(third.ok).toBe(false)
    expect((third as { ok: false; reason: string }).reason).toBe('full')
  })

  it('removePlayerBeforeStart: 試合開始前（waiting）の退出は敗北扱いにしない（単に部屋から外れる）', () => {
    let state = createRoom('m1', 'friend', 'ABCDEF', sampleProblemSet())
    state = (addPlayer(state, 'a', PROFILE_A, false) as { ok: true; state: BattleRoomState }).state
    state = removePlayerBeforeStart(state, 'a')
    expect(state.players.length).toBe(0)
  })

  it('decideStartIfReady: 両者connected+readyで初めてstartAtが確定し、phaseがin_progressになる', () => {
    let state = createRoom('m1', 'world', null, sampleProblemSet())
    state = (addPlayer(state, 'a', PROFILE_A, true) as { ok: true; state: BattleRoomState }).state
    state = (addPlayer(state, 'b', PROFILE_B, true) as { ok: true; state: BattleRoomState }).state
    expect(state.startAt).toBeNull()
    state = decideStartIfReady(state, 1000, 3000)
    expect(state.startAt).toBe(4000)
    expect(state.phase).toBe('in_progress')
  })

  it('decideStartIfReady: 世界対戦のロスター事前登録（connected=false）では、片方の実WebSocketが先に繋がっただけではstartAtが確定しない（実際に踏んだ不具合の再発防止）', () => {
    // Matchmakerが2人を確定させた直後のBattleRoom /internal/create相当: 両者readyだが
    // どちらの実WebSocketもまだ開いていない。
    let state = createRoom('m1', 'world', null, sampleProblemSet())
    state = (addPlayer(state, 'a', PROFILE_A, true, false) as { ok: true; state: BattleRoomState }).state
    state = (addPlayer(state, 'b', PROFILE_B, true, false) as { ok: true; state: BattleRoomState }).state
    // 既存プレイヤーへの再addPlayer呼び出し（=実WebSocket接続の瞬間）はconnectedを
    // 無条件でtrueにする。ここではaだけが先に繋がった状態を再現する。
    state = (addPlayer(state, 'a', PROFILE_A, true) as { ok: true; state: BattleRoomState }).state
    state = decideStartIfReady(state, 1000, 3000)
    expect(state.startAt).toBeNull()
    expect(state.phase).toBe('waiting')

    // bの実WebSocketも繋がって初めて両者trueになり、startAtが確定する。
    state = (addPlayer(state, 'b', PROFILE_B, true) as { ok: true; state: BattleRoomState }).state
    state = decideStartIfReady(state, 1000, 3000)
    expect(state.startAt).toBe(4000)
    expect(state.phase).toBe('in_progress')
  })

  it('decideStartIfReady: 一度確定したstartAtは再呼び出しでも変わらない（冪等）', () => {
    let state = createRoom('m1', 'world', null, sampleProblemSet())
    state = (addPlayer(state, 'a', PROFILE_A, true) as { ok: true; state: BattleRoomState }).state
    state = (addPlayer(state, 'b', PROFILE_B, true) as { ok: true; state: BattleRoomState }).state
    state = decideStartIfReady(state, 1000, 3000)
    const again = decideStartIfReady(state, 999999, 3000)
    expect(again.startAt).toBe(state.startAt)
  })

  it('decideStartIfReady: 片方だけreadyではstartAtが確定しない', () => {
    let state = createRoom('m1', 'friend', 'ABCDEF', sampleProblemSet())
    state = (addPlayer(state, 'a', PROFILE_A, false) as { ok: true; state: BattleRoomState }).state
    state = (addPlayer(state, 'b', PROFILE_B, false) as { ok: true; state: BattleRoomState }).state
    state = markReady(state, 'a')
    state = decideStartIfReady(state, 1000, 3000)
    expect(state.startAt).toBeNull()
  })
})

function startedRoom(): BattleRoomState {
  let state = createRoom('m1', 'world', null, sampleProblemSet())
  state = (addPlayer(state, 'a', PROFILE_A, true) as { ok: true; state: BattleRoomState }).state
  state = (addPlayer(state, 'b', PROFILE_B, true) as { ok: true; state: BattleRoomState }).state
  state = decideStartIfReady(state, 0, 3000)
  return state
}

describe('battleRoomEngine: submitAnswer（server authoritative検証、Ver.6 Phase 6）', () => {
  it('正しい順序のanswerは記録され、nextExpectedQuestionIndexが進む', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0 }))
    expect(result.ok).toBe(true)
    const next = (result as { ok: true; state: BattleRoomState }).state
    expect(next.players[0].answers.length).toBe(1)
    expect(next.players[0].nextExpectedQuestionIndex).toBe(1)
  })

  it('存在しないquestionIndex（problemSet範囲外）は拒否される', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 99 }))
    expect(result.ok).toBe(false)
  })

  it('順序違反（次に期待するindexと不一致）は拒否される', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 1 }))
    expect(result.ok).toBe(false)
  })

  it('同じ問題への重複回答は拒否される', () => {
    let state = startedRoom()
    state = (submitAnswer(state, 'a', answer({ questionIndex: 0 })) as { ok: true; state: BattleRoomState }).state
    const dup = submitAnswer(state, 'a', answer({ questionIndex: 0 }))
    expect(dup.ok).toBe(false)
  })

  it('不可能なreaction time（targetTimeMs+slackを超える）は拒否される', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0, reactionMs: 999999 }))
    expect(result.ok).toBe(false)
  })

  it('負のreaction timeは拒否される', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0, reactionMs: -1 }))
    expect(result.ok).toBe(false)
  })

  it('不可能なscore jumpは拒否される', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0, scoreDelta: 10000 }))
    expect(result.ok).toBe(false)
  })

  it('bonusTime以外の問題でbonusGainDeltaを申告すると拒否される', () => {
    const state = startedRoom()
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0, bonusGainDelta: 5 }))
    expect(result.ok).toBe(false)
  })

  it('bonusTimeの問題ではbonusGainDeltaが妥当範囲内なら受理される', () => {
    let state = startedRoom()
    state = (submitAnswer(state, 'a', answer({ questionIndex: 0 })) as { ok: true; state: BattleRoomState }).state
    state = (submitAnswer(state, 'a', answer({ questionIndex: 1 })) as { ok: true; state: BattleRoomState }).state
    const result = submitAnswer(state, 'a', answer({ questionIndex: 2, bonusGainDelta: 8 }))
    expect(result.ok).toBe(true)
  })

  it('既に終了した試合へのanswerは拒否される（phase!==in_progress）', () => {
    let state = startedRoom()
    state = { ...state, phase: 'finished' }
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0 }))
    expect(result.ok).toBe(false)
  })

  it('既にfinished送信済みのplayerからのanswerは拒否される', () => {
    let state = startedRoom()
    state = submitFinished(state, 'a', performance()).state
    const result = submitAnswer(state, 'a', answer({ questionIndex: 0 }))
    expect(result.ok).toBe(false)
  })
})

describe('battleRoomEngine: finish/forfeit/disconnect（Ver.6 Phase 6）', () => {
  it('submitFinished: 両者がfinishedになるとbothFinished=trueを返す', () => {
    let state = startedRoom()
    let result = submitFinished(state, 'a', performance())
    expect(result.bothFinished).toBe(false)
    state = result.state
    result = submitFinished(state, 'b', performance())
    expect(result.bothFinished).toBe(true)
  })

  it('applyForfeit: 棄権したplayerはforfeited=trueになり、finalizeResultで相手がWIN・finishReason=forfeit', () => {
    let state = startedRoom()
    state = applyForfeit(state, 'a')
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerB')
    expect(result.finishReason).toBe('forfeit')
  })

  it('applyDisconnect + isDisconnectTimedOut: 5秒以内はtimeoutにならない', () => {
    let state = startedRoom()
    state = applyDisconnect(state, 'a', 1000)
    expect(isDisconnectTimedOut(state.players[0], 1000 + 4999, 5000)).toBe(false)
  })

  it('applyDisconnect + isDisconnectTimedOut: 5秒経過でtimeoutになり、finalizeResultで相手がWIN・finishReason=disconnect', () => {
    let state = startedRoom()
    state = applyDisconnect(state, 'a', 1000)
    expect(isDisconnectTimedOut(state.players[0], 1000 + 5000, 5000)).toBe(true)
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerB')
    expect(result.finishReason).toBe('disconnect')
  })

  it('applyReconnect: 5秒以内に復帰すればdisconnectedAtがクリアされ、timeoutと判定されなくなる', () => {
    let state = startedRoom()
    state = applyDisconnect(state, 'a', 1000)
    state = applyReconnect(state, 'a')
    expect(state.players[0].disconnectedAt).toBeNull()
    expect(isDisconnectTimedOut(state.players[0], 999999, 5000)).toBe(false)
  })

  it('一瞬の通信揺れ（即復帰）は即敗北にしない: disconnect直後にreconnectすればfinalizeResultはcompletedのまま使える', () => {
    let state = startedRoom()
    state = applyDisconnect(state, 'a', 1000)
    state = applyReconnect(state, 'a')
    state = submitFinished(state, 'a', performance()).state
    state = submitFinished(state, 'b', performance()).state
    const result = finalizeResult(state)
    expect(result.finishReason).toBe('completed')
  })
})

describe('battleRoomEngine: finalizeResult（多指標判定・draw、Ver.6 Phase 6）', () => {
  function finished(perfA: ChallengePerformance, perfB: ChallengePerformance, answersA: BattleAnswerEvent[] = [], answersB: BattleAnswerEvent[] = []) {
    let state = startedRoom()
    state = { ...state, players: state.players.map((p) => (p.playerId === 'a' ? { ...p, answers: answersA } : { ...p, answers: answersB })) }
    state = submitFinished(state, 'a', perfA).state
    state = submitFinished(state, 'b', perfB).state
    return state
  }

  it('finalDopaPercentが異なれば、それだけで決着する', () => {
    const state = finished(performance({ finalDopaPercent: 90 }), performance({ finalDopaPercent: 80 }))
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerA')
    expect(result.decidedBy).toBe('finalDopaPercent')
  })

  it('finalDopaPercent同値 → baseDopaPercentで決着する（item 14の例: 最終100%同値でもbase92%<97%ならB勝ち）', () => {
    const state = finished(
      performance({ finalDopaPercent: 100, baseDopaPercent: 92 }),
      performance({ finalDopaPercent: 100, baseDopaPercent: 97 }),
    )
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerB')
    expect(result.decidedBy).toBe('baseDopaPercent')
  })

  it('finalDopaPercent・baseDopaPercent同値 → accuracyで決着する（answerログから再計算したaccuracyで比較）', () => {
    const answersA: BattleAnswerEvent[] = [
      { questionIndex: 0, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
      { questionIndex: 1, correct: false, reactionMs: 300, scoreDelta: -5, bonusGainDelta: 0 },
    ] // accuracy 0.5
    const answersB: BattleAnswerEvent[] = [
      { questionIndex: 0, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
      { questionIndex: 1, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
    ] // accuracy 1.0
    const same = performance({ finalDopaPercent: 80, baseDopaPercent: 80 })
    const state = finished(same, same, answersA, answersB)
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerB')
    expect(result.decidedBy).toBe('accuracy')
  })

  it('finalDopaPercent・baseDopaPercent・accuracy同値 → maxComboで決着する（answerログから再計算したmaxComboで比較）', () => {
    const answersA: BattleAnswerEvent[] = [
      { questionIndex: 0, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
      { questionIndex: 1, correct: false, reactionMs: 300, scoreDelta: -5, bonusGainDelta: 0 },
      { questionIndex: 2, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
    ] // accuracy 2/3, maxCombo 1
    const answersB: BattleAnswerEvent[] = [
      { questionIndex: 0, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
      { questionIndex: 1, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
      { questionIndex: 2, correct: false, reactionMs: 300, scoreDelta: -5, bonusGainDelta: 0 },
    ] // accuracy 2/3, maxCombo 2
    const same = performance({ finalDopaPercent: 80, baseDopaPercent: 80 })
    const state = finished(same, same, answersA, answersB)
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerB')
    expect(result.decidedBy).toBe('maxCombo')
  })

  it('finalDopaPercent・baseDopaPercent・accuracy・maxCombo同値 → medianCorrectReactionMsで決着する（小さい方が勝ち）', () => {
    const answersA: BattleAnswerEvent[] = [{ questionIndex: 0, correct: true, reactionMs: 900, scoreDelta: 4, bonusGainDelta: 0 }]
    const answersB: BattleAnswerEvent[] = [{ questionIndex: 0, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 }]
    const same = performance({ finalDopaPercent: 80, baseDopaPercent: 80 })
    const state = finished(same, same, answersA, answersB)
    const result = finalizeResult(state)
    expect(result.winner).toBe('playerB')
    expect(result.decidedBy).toBe('medianCorrectReactionMs')
  })

  it('accuracy/maxCombo/medianCorrectReactionMsはクライアント自己申告を無視し、answerログから再計算する', () => {
    // 自己申告のperformanceはどちらも同一（正答率0.5・COMBO1・median999）だが、実際のanswerログは
    // Aが全問正解（accuracy=1, maxCombo=2, medianは実際の反応速度）という食い違いを再現する。
    const answersA: BattleAnswerEvent[] = [
      { questionIndex: 0, correct: true, reactionMs: 300, scoreDelta: 4, bonusGainDelta: 0 },
      { questionIndex: 1, correct: true, reactionMs: 500, scoreDelta: 4, bonusGainDelta: 0 },
    ]
    const selfReported = performance({ finalDopaPercent: 80, baseDopaPercent: 80, accuracy: 0.5, maxCombo: 1, medianCorrectReactionMs: 999 })
    const state = finished(selfReported, selfReported, answersA, [])
    const result = finalizeResult(state)
    expect(result.playerA.performance.accuracy).toBe(1)
    expect(result.playerA.performance.maxCombo).toBe(2)
    expect(result.playerA.performance.medianCorrectReactionMs).toBe(400)
    // 自己申告のfinalDopaPercent/baseDopaPercentは不変条件(base<=final)の範囲内なのでそのまま使われる。
    expect(result.playerA.performance.finalDopaPercent).toBe(80)
  })

  it('baseDopaPercentがfinalDopaPercentを超える自己申告は、finalDopaPercentへクランプされる（不変条件の強制）', () => {
    const state = finished(performance({ finalDopaPercent: 50, baseDopaPercent: 999 }), performance())
    const result = finalizeResult(state)
    expect(result.playerA.performance.baseDopaPercent).toBeLessThanOrEqual(result.playerA.performance.finalDopaPercent)
  })

  it('全5指標が完全同値ならdraw・decidedBy=exactTie', () => {
    const same = performance()
    const state = finished(same, same)
    const result = finalizeResult(state)
    expect(result.winner).toBe('draw')
    expect(result.decidedBy).toBe('exactTie')
  })

  it('正解した問題が無ければmedianCorrectReactionMsはnull（Challengeと同じ扱い）', () => {
    const answersA: BattleAnswerEvent[] = [{ questionIndex: 0, correct: false, reactionMs: 500, scoreDelta: -5, bonusGainDelta: 0 }]
    const state = finished(performance(), performance(), answersA, [])
    const result = finalizeResult(state)
    expect(result.playerA.performance.medianCorrectReactionMs).toBeNull()
  })
})
