/**
 * 「後半だから理不尽に時間切れになる」を防ぐための、問題タイプ別の最低制限時間ルール。
 * 各問題のtargetTimeMsは必ず
 *   max(baseTargetTimeMs × フェーズのspeedMultiplier, ここで計算した最低ライン)
 * になるようにする（questionPicker.ts）。
 */
export const TIMING_SAFETY = {
  hold: {
    /**
     * 反応してから指を置くまでに見込む時間。Ver.4.3で引き上げ：
     * 直前の問題タイプから「押す」動作→「押し続ける」動作への切り替えコストを考慮すると
     * 450msでは実機で反応が間に合わないケースがあった。
     */
    reactionBufferMs: 700,
    /** 誤差・通信遅延などに対する余裕 */
    safetyMarginMs: 300,
    /**
     * Ver.4.3: 指を置いた瞬間、外側の自動失敗タイマーをrequiredMs+この値で引き直す。
     * rAFの取りこぼし対策の猶予であり、「必要時間を満たしたのにtimeoutが先に発火する」を構造的に防ぐ。
     */
    completionSafetyMs: 250,
  },
  repeatTap: {
    /** 1タップあたりに現実的に必要な最短間隔（連打の限界を考慮） */
    perTapMs: 190,
    reactionBufferMs: 350,
    /** 停止確認フェーズ終了後の余裕（Ver.4.2） */
    stopSafetyMarginMs: 150,
  },
  swipe: {
    /** スワイプ操作（指を置く→動かす→離す）を完了できる最低時間 */
    minTimeMs: 650,
  },
  simpleMath: {
    /** 単純な色選択より少し長めに見る時間を保証する */
    minTimeMs: 900,
  },
  /** Ver.4.2で追加した新お題の最低制限時間ルール */
  goWait: {
    /** GO表示後、反応してタップするまでに見込む最低時間 */
    minReactionWindowMs: 700,
    safetyMarginMs: 150,
  },
  skipWait: {
    minReactionWindowMs: 650,
    safetyMarginMs: 150,
  },
  /** Ver.4.5: 信号連打（緑→赤→緑→赤の4フェーズ）。実際の所要時間はdataのphases合計そのものなので、
   *  ここでは安全マージンのみ持つ。 */
  rapidStop: {
    safetyMarginMs: 200,
  },
  stopAt100: {
    /** 100付近に到達してから反応してタップするまでに見込む時間 */
    reactionBufferMs: 700,
    safetyMarginMs: 200,
  },
  clearNotifications: {
    /** 対象1個あたり、探して正しくタップするのに現実的に必要な時間 */
    perTargetMs: 480,
    reactionBufferMs: 300,
  },
  spotChange: {
    minReactionWindowMs: 650,
    safetyMarginMs: 150,
  },
  /** 高速仕分け（Ver.4.3で復活）：見て仕分けて指を動かし切るまでの最低時間 */
  foodSort: {
    minTimeMs: 700,
  },
  /** Ver.4.5で追加した新お題の最低制限時間ルール */
  sequenceTap: {
    /** 1〜4の各数字を探してタップするのに現実的に必要な時間 */
    perNumberMs: 260,
    reactionBufferMs: 350,
  },
  findTarget: {
    minTimeMs: 900,
  },
  releaseZone: {
    /** 押してからゲージが動き出すまでに見込む反応時間 */
    reactionBufferMs: 350,
    safetyMarginMs: 200,
  },
  shortVideoSwipe: {
    perSwipeMs: 480,
    reactionBufferMs: 300,
  },
  colorWord: {
    minTimeMs: 900,
  },
  flashSpot: {
    minReactionWindowMs: 500,
    safetyMarginMs: 150,
  },
  notifRush: {
    /** 赤1個あたり、出現待ち～発見～タップを現実的に見込む時間（スポーン間隔のブレを吸収する余裕込み） */
    perRedMs: 520,
    reactionBufferMs: 500,
  },
  /** どの問題タイプにも適用する絶対最小値（暴走防止の安全弁） */
  absoluteFloorMs: 450,
}
