/**
 * 「後半だから理不尽に時間切れになる」を防ぐための、問題タイプ別の最低制限時間ルール。
 * 各問題のtargetTimeMsは必ず
 *   max(baseTargetTimeMs × フェーズのspeedMultiplier, ここで計算した最低ライン)
 * になるようにする（questionPicker.ts）。
 */
export const TIMING_SAFETY = {
  hold: {
    /** 反応してから指を置くまでに見込む時間 */
    reactionBufferMs: 450,
    /** 誤差・通信遅延などに対する余裕 */
    safetyMarginMs: 200,
  },
  repeatTap: {
    /** 1タップあたりに現実的に必要な最短間隔（連打の限界を考慮） */
    perTapMs: 190,
    reactionBufferMs: 350,
  },
  swipe: {
    /** スワイプ操作（指を置く→動かす→離す）を完了できる最低時間 */
    minTimeMs: 650,
  },
  simpleMath: {
    /** 単純な色選択より少し長めに見る時間を保証する */
    minTimeMs: 900,
  },
  /** どの問題タイプにも適用する絶対最小値（暴走防止の安全弁） */
  absoluteFloorMs: 450,
}
