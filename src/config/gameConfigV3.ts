/**
 * Ver.3「ドパガキゲーム」の数値設定。
 * GAME SCOREの報酬額・時間・ドパガキ診断の採点基準などはすべてここに集約する。
 * ここの数値を変えるだけで、コードを触らずにゲームバランスを調整できる。
 */

export interface TimeBand {
  maxMs: number
  score: number
}

export interface CountBand {
  max: number
  score: number
}

export function scoreByElapsed(elapsedMs: number, bands: TimeBand[], fallback: number): number {
  for (const band of bands) {
    if (elapsedMs <= band.maxMs) return band.score
  }
  return fallback
}

export function scoreByCount(count: number, bands: CountBand[], fallback: number): number {
  for (const band of bands) {
    if (count <= band.max) return band.score
  }
  return fallback
}

export const V3_CONFIG = {
  /** 1プレイの制限時間（ミリ秒） */
  totalTimeMs: 60_000,
  /** 各イベント開始時、指示文だけを見せる時間（ミリ秒） */
  introDurationMs: 1000,
  /** 中盤で選ぶイベント数の範囲 */
  eventCountMin: 7,
  eventCountMax: 8,
  /** EVENT J（途中診断チラ見）が終盤候補として差し込まれる確率 */
  peekEventChance: 0.3,
  /** ドパガキ度算出時、このスコア以上のイベントを「犯行記録」候補にする */
  crimeThreshold: 55,
  /** スコアポップアップの表示時間（ms） */
  popupDurationMs: 900,
  /** window.location.href が取得できない環境向けのフォールバックURL */
  shareUrl: 'https://dopagaki-game.example.com',

  events: {
    videoMemory: {
      shapeCount: 7,
      perShapeMs: 750,
      speedMultiplier: 2,
      speedToggleShowDelayMs: 400,
      correct: 1000,
      incorrect: 0,
      bands: [
        { maxMs: 700, score: 90 },
        { maxMs: 1500, score: 65 },
        { maxMs: 2800, score: 40 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    skipQuiz: {
      skipShowDelayMs: 700,
      /** SKIPせず最後まで読んだ場合、説明表示からこの時間で自動的にクイズへ進む */
      readAutoAdvanceMs: 3800,
      correct: 1000,
      incorrect: 0,
      bands: [
        { maxMs: 1000, score: 88 },
        { maxMs: 1800, score: 62 },
        { maxMs: 2800, score: 38 },
      ] satisfies TimeBand[],
      fallbackScore: 12,
    },
    comboBoost: {
      autoFillMs: 6000,
      tapBoostPercent: 2.2,
      reward: 700,
      tapBands: [
        { max: 3, score: 12 },
        { max: 10, score: 45 },
        { max: 20, score: 72 },
      ] satisfies CountBand[],
      fallbackScore: 92,
    },
    instantReward: {
      immediateReward: 300,
      waitMs: 3000,
      waitReward: 1000,
      bands: [
        { maxMs: 800, score: 85 },
        { maxMs: 1800, score: 60 },
      ] satisfies TimeBand[],
      fallbackScoreImmediate: 40,
      fallbackScoreWait: 15,
    },
    notificationReflex: {
      waitMinMs: 1000,
      waitMaxMs: 2200,
      reactionWindowMs: 1500,
      successReward: 500,
      failReward: 0,
      notifShowMinMs: 400,
      notifShowMaxMs: 1000,
      notifAutoHideMs: 2200,
      notifWinChance: 0.3,
      notifWinReward: 500,
      bands: [
        { maxMs: 500, score: 90 },
        { maxMs: 1200, score: 62 },
      ] satisfies TimeBand[],
      fallbackScore: 15,
    },
    sortRush: {
      cardCount: 5,
      perCardTimeoutMs: 2400,
      correctReward: 200,
      incorrectPenalty: -50,
      fastMsThreshold: 450,
      moderateMsThreshold: 750,
    },
    holdRelease: {
      maxMs: 5000,
      tierMs: 1000,
      tierReward: 200,
      autoReward: 1000,
      bands: [
        { maxMs: 1000, score: 88 },
        { maxMs: 2000, score: 66 },
        { maxMs: 3000, score: 44 },
        { maxMs: 4000, score: 22 },
      ] satisfies TimeBand[],
      fallbackScore: 8,
    },
    adCountdown: {
      countdownMs: 5000,
      reward: 900,
      bands: [
        { maxMs: 1000, score: 90 },
        { maxMs: 2500, score: 62 },
        { maxMs: 4000, score: 36 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    treasureBox: {
      hintDelayMs: 3000,
      reward: 1200,
      bands: [
        { maxMs: 900, score: 85 },
        { maxMs: 2000, score: 55 },
      ] satisfies TimeBand[],
      fallbackScore: 20,
    },
    peekResult: {
      windowMs: 2200,
      peekDisplayMs: 1000,
      bands: [
        { maxMs: 700, score: 92 },
        { maxMs: 1500, score: 70 },
      ] satisfies TimeBand[],
      fallbackScore: 10,
    },
    gambleChoice: {
      safeReward: 500,
      gambleWinChance: 0.5,
      gambleWinReward: 1500,
      gambleLoseReward: 0,
      safeScore: 35,
      gambleScore: 55,
      diagnosticWeight: 0.3,
    },
  },
}
