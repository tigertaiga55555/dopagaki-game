/**
 * 「後半だから理不尽に時間切れになる」を防ぐための、問題タイプ別の最低制限時間ルール。
 * 各問題のtargetTimeMsは必ず
 *   max(baseTargetTimeMs × フェーズのspeedMultiplier, ここで計算した最低ライン)
 * になるようにする（questionPicker.ts）。
 */
export const TIMING_SAFETY = {
  /**
   * Ver.4.8で追加：color/oddOneOut/maxNumber/minNumber/differentOne/sameOne/moreSide/biggerShape
   * の8種は、これまでcomputeMinTargetTimeMsを一切実装しておらず、baseTargetTimeMs×speedMultiplier
   * だけでtargetTimeMsが決まっていた。そのためFINAL DOPA RUSH（speedMultiplier 0.58）では
   * 「見て→判断して→押す」に必要な人間の最低時間を割り込み、分かっていても物理的に
   * 間に合わないケースが発生していた。ここで問題タイプごとの最低ラインを明示する。
   */
  reactionMinMs: {
    /** 単純な色の一致（4択から1色を選ぶだけ） */
    color: 1300,
    /** 4つの中から視覚的に浮いている1つを見つける */
    oddOneOut: 1550,
    /** 4つの数字を比較して最大/最小を選ぶ */
    maxNumber: 1550,
    minNumber: 1550,
    /** 4色の中から周りと違う1色を見つける */
    differentOne: 1500,
    /** 4つの中から同じもの2つを見つける */
    sameOne: 1550,
    /** 左右の点の数を比較する（2択） */
    moreSide: 1300,
    /** 左右の丸の大きさを比較する（2択） */
    biggerShape: 1200,
    /** Ver.5.0: 左右の点の数を比較する（2択）。moreSideと同じ帯域。 */
    fewerSide: 1300,
  },
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
    /** 停止確認フェーズ終了後の余裕（Ver.4.2、Ver.4.8でさらに拡大） */
    stopSafetyMarginMs: 220,
    /**
     * Ver.4.8: 静電容量タッチパネルが高速連打中に1回の物理タップを2回のpointerdownとして
     * 誤検知する「コンタクトバウンス」対策。人間の連打限界（およそ100ms以上の間隔）より
     * 十分短い間隔の重複入力はバウンスとみなして無視する。
     */
    minTapIntervalMs: 45,
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
  /** 高速仕分け（Ver.4.3で復活）：見て仕分けて指を動かし切るまでの最低時間。
   *  Ver.4.8で700→1100に引き上げ（アイコンを認識してからスワイプし切るまでの現実的な時間）。 */
  foodSort: {
    minTimeMs: 1100,
  },
  /** Ver.4.5で追加した新お題の最低制限時間ルール。
   *  Ver.4.8：視覚探索を伴う問題として人間の最低時間帯（1800〜2300ms）に収まるよう引き上げ。 */
  sequenceTap: {
    /** 1〜4の各数字を探してタップするのに現実的に必要な時間 */
    perNumberMs: 350,
    reactionBufferMs: 500,
  },
  /** Ver.4.8：8〜12個から1つを探す視覚探索のため900→2000に引き上げ */
  findTarget: {
    minTimeMs: 2000,
  },
  releaseZone: {
    /** 押してからゲージが動き出すまでに見込む反応時間 */
    reactionBufferMs: 350,
    safetyMarginMs: 200,
  },
  /** Ver.4.8：1回ごとの猶予を480→520、反応バッファを300→400に引き上げ */
  shortVideoSwipe: {
    perSwipeMs: 520,
    reactionBufferMs: 400,
  },
  /** Ver.4.8：ストループ課題（文字の意味と色が競合する）は視覚探索系と同じ帯域まで引き上げ */
  colorWord: {
    minTimeMs: 1900,
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
  /** Ver.4.9で追加した新お題5種の最低制限時間ルール */
  arrowSwipe: {
    minTimeMs: 1350,
  },
  /** 認知抑制系（矢印の逆へスワイプ）のためarrowSwipeより長め */
  reverseArrowSwipe: {
    minTimeMs: 1800,
  },
  evenNumber: {
    minTimeMs: 1450,
  },
  /** ターゲット出現後、発見してタップするのに見込む最低時間 */
  popTarget: {
    minReactionWindowMs: 1050,
    safetyMarginMs: 150,
  },
  /** ドラッグ操作（掴む→運ぶ→離す）を完了できる最低時間 */
  dragGoal: {
    minTimeMs: 2250,
  },
  /** Ver.5.0で追加した通常お題3種の最低制限時間ルール。evenNumberと同じ帯域（対になる問題のため）。 */
  oddNumber: {
    minTimeMs: 1450,
  },
  /** じゃんけん：相手の手を見て正しい手を選ぶまでの現実的な時間（simpleMathと同程度） */
  rps: {
    minTimeMs: 1900,
  },
}
