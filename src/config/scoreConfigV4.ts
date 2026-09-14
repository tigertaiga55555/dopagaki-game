/**
 * Ver.4のスコア設定。触りながら調整することを想定し、数値はすべてここに集約する。
 */
export const SCORE_CONFIG = {
  basePoints: 100,
  tierMultiplier: {
    PERFECT: 1.4,
    GREAT: 1.1,
    GOOD: 0.8,
    MISS: 0,
  },
  /** MISS時にrawScoreから引く固定ペナルティ（0未満にはしない） */
  missPenalty: 35,
  /** COMBO1につき加算する固定ボーナス点（comboBonusCapCountで頭打ち） */
  comboBonusPoints: 6,
  comboBonusCapCount: 20,
  /** rawScoreをこの値で割った値が100%相当になる（プレイテストで調整） */
  targetRawScoreFor100: 2500,
  /** ドパガキ度の表示を滑らかに増減させる時間（ms）。MISSでも急激に落ちて見えないようにする。 */
  percentTweenMs: 380,
}

/** 反応時間 / 制限時間 の比率で判定する閾値 */
export const JUDGE_CONFIG = {
  perfectRatio: 0.35,
  greatRatio: 0.6,
  goodRatio: 1.0,
}

export function judgeByRatio(reactionMs: number, targetTimeMs: number): 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS' {
  if (targetTimeMs <= 0) return 'GOOD'
  const ratio = reactionMs / targetTimeMs
  if (ratio <= JUDGE_CONFIG.perfectRatio) return 'PERFECT'
  if (ratio <= JUDGE_CONFIG.greatRatio) return 'GREAT'
  if (ratio <= JUDGE_CONFIG.goodRatio) return 'GOOD'
  return 'MISS'
}
