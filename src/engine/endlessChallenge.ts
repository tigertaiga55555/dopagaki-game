import { ENDLESS_CONFIG } from '../config/endlessConfig'

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の純粋な状態遷移ロジック。
 * 画面コンポーネントやReactの状態管理から完全に切り離してあるため、vitestで
 * 入出力だけを検証できる（責務分離・テスト容易性のため、UIに一切依存しない）。
 */
export interface EndlessState {
  /** 現在の％ */
  percent: number
  /** 現在確保している床（これを下回ったら終了）。開始時はstartPercentそのもの。 */
  floor: number
  /** チャレンジが終了したか（MISSで床に到達、または500%到達） */
  ended: boolean
  /** 500%に到達して完全クリアしたか */
  cleared: boolean
}

export function createEndlessState(): EndlessState {
  return {
    percent: ENDLESS_CONFIG.startPercent,
    floor: ENDLESS_CONFIG.startPercent,
    ended: false,
    cleared: false,
  }
}

/** 到達済みの％から、新しく確保すべき床（最も高いチェックポイント）を返す。 */
function securedFloor(currentFloor: number, percent: number): number {
  let next = currentFloor
  for (const checkpoint of ENDLESS_CONFIG.checkpoints) {
    if (percent >= checkpoint && checkpoint > next) next = checkpoint
  }
  return next
}

/** 正解1問：+correctGain%。500%以上に達した場合はちょうど500%で完全クリア終了。 */
export function applyCorrect(state: EndlessState): EndlessState {
  if (state.ended) return state
  const raw = state.percent + ENDLESS_CONFIG.correctGain
  if (raw >= ENDLESS_CONFIG.clearPercent) {
    return { percent: ENDLESS_CONFIG.clearPercent, floor: ENDLESS_CONFIG.clearPercent, ended: true, cleared: true }
  }
  return { percent: raw, floor: securedFloor(state.floor, raw), ended: false, cleared: false }
}

/**
 * MISS1回：-missPenalty%。計算結果が現在の床以下になった場合は、その時点で
 * チャレンジ終了とし、％は床にクランプする（床を下回った状態では終わらせない）。
 * 床へ届かない通常のMISSであれば、％を減らしたまま続行する。
 */
export function applyMiss(state: EndlessState): EndlessState {
  if (state.ended) return state
  const raw = state.percent - ENDLESS_CONFIG.missPenalty
  if (raw <= state.floor) {
    return { percent: state.floor, floor: state.floor, ended: true, cleared: false }
  }
  return { percent: raw, floor: state.floor, ended: false, cleared: false }
}
