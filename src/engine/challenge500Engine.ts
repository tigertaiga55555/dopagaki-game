import { CHALLENGE500_CONFIG, tierForPercent } from '../config/challenge500Config'

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の純粋な状態遷移ロジック。
 * 画面コンポーネントやReactの状態管理から完全に切り離してあるため、vitestで
 * 入出力だけを検証できる（責務分離・テスト容易性のため、UIに一切依存しない）。
 */
export interface Challenge500State {
  /** 現在の％ */
  percent: number
  /** 現在確保している床（これを下回ったら終了）。開始時はstartPercentそのもの。 */
  floor: number
  /** チャレンジが終了したか（MISSで床に到達、または500%到達） */
  ended: boolean
  /** 500%に到達して完全クリアしたか */
  cleared: boolean
}

export function createChallenge500State(): Challenge500State {
  return {
    percent: CHALLENGE500_CONFIG.startPercent,
    floor: CHALLENGE500_CONFIG.startPercent,
    ended: false,
    cleared: false,
  }
}

/** 到達済みの％から、新しく確保すべき床（最も高いチェックポイント）を返す。 */
function securedFloor(currentFloor: number, percent: number): number {
  let next = currentFloor
  for (const checkpoint of CHALLENGE500_CONFIG.checkpoints) {
    if (percent >= checkpoint && checkpoint > next) next = checkpoint
  }
  return next
}

/** 正解1問：+correctGain%。500%以上に達した場合はちょうど500%で完全クリア終了。 */
export function applyCorrect(state: Challenge500State): Challenge500State {
  if (state.ended) return state
  const raw = state.percent + CHALLENGE500_CONFIG.correctGain
  if (raw >= CHALLENGE500_CONFIG.clearPercent) {
    return { percent: CHALLENGE500_CONFIG.clearPercent, floor: CHALLENGE500_CONFIG.clearPercent, ended: true, cleared: true }
  }
  return { percent: raw, floor: securedFloor(state.floor, raw), ended: false, cleared: false }
}

/**
 * QA/Preview専用: 実際のapplyCorrect/applyMissの連打を経由せず、指定％に到達した
 * 状態を直接構築する（本番の状態遷移ロジックそのものは一切変更しない、素通りの
 * ヘルパー）。securedFloorを再利用するため、300/400チェックポイントが「一度確保したら
 * 二度と下回らない」という本番と同じ規則がQAのジャンプ結果にもそのまま反映される。
 * clearPercent（500）以上を指定した場合はちょうど500%で完全クリア状態にする。
 */
export function createChallenge500StateAt(percent: number): Challenge500State {
  if (percent >= CHALLENGE500_CONFIG.clearPercent) {
    return { percent: CHALLENGE500_CONFIG.clearPercent, floor: CHALLENGE500_CONFIG.clearPercent, ended: true, cleared: true }
  }
  const floor = securedFloor(CHALLENGE500_CONFIG.startPercent, percent)
  return { percent, floor, ended: false, cleared: false }
}

/**
 * MISS1回。現在の％が属するtierごとにペナルティ規則が異なる（再設計版）。
 *
 * tier1（200〜299%）: -missPenaltyTier1%。
 * tier2（300〜399%）: -missPenaltyTier2%（tier1より重い）。
 * tier3（400〜499%）: ペナルティ％計算ではなく、1 MISSで即終了し400%（floor）へ戻る
 *   （400〜500%は10連続正解を要求する最終区間として扱うため）。
 *
 * tier1/tier2では、計算結果が現在の床以下になった場合はその時点でチャレンジ終了とし、
 * ％は床にクランプする（床を下回った状態では終わらせない）。床へ届かない通常のMISSで
 * あれば、％を減らしたまま続行する。
 * 例: 390(tier2)→MISS→320（続行）/ 350(tier2)→MISS→300にクランプ（終了）/
 *     490(tier3)→MISS→400（終了）。
 */
export function applyMiss(state: Challenge500State): Challenge500State {
  if (state.ended) return state
  const tier = tierForPercent(state.percent)
  if (tier === 3) {
    return { percent: state.floor, floor: state.floor, ended: true, cleared: false }
  }
  const penalty = tier === 1 ? CHALLENGE500_CONFIG.missPenaltyTier1 : CHALLENGE500_CONFIG.missPenaltyTier2
  const raw = state.percent - penalty
  if (raw <= state.floor) {
    return { percent: state.floor, floor: state.floor, ended: true, cleared: false }
  }
  return { percent: raw, floor: state.floor, ended: false, cleared: false }
}
