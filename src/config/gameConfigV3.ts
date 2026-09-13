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
  /** 中盤で選ぶイベント数の範囲（メインプールが9種のため、多様性を保つため7〜8から6〜7に調整） */
  eventCountMin: 6,
  eventCountMax: 7,
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
      /** 乱入ボーナスの対象になる最低ゲージ進捗（%） */
      interruptEligibleAtPercent: 30,
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
    sortRush: {
      cardCount: 5,
      perCardTimeoutMs: 2400,
      correctReward: 200,
      incorrectPenalty: -50,
      fastMsThreshold: 450,
      moderateMsThreshold: 750,
      /** 連続正解1回ごとのコンボボーナス（例: COMBO×3なら+60加算） */
      comboBonusPerStreak: 20,
      /** 乱入ボーナスの対象になる最低コンボ数 */
      comboInterruptEligibleAt: 2,
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

  /**
   * 乱入ボーナス（Ver.3.1）。
   * comboBoost / sortRush など「積み上げた進捗」を持つイベントの最中に、
   * 本当に得する可能性のある高報酬サイドイベントを突然出す。
   * 乗り換えると今の進捗（コンボ／ゲージ）を手放すという明確なトレードオフにする。
   */
  bonusInterrupt: {
    /** 条件を満たしても、このプレイでは出現しない場合がある（毎回は出さない） */
    triggerChance: 0.55,
    /** 条件を満たしてから、実際に出現するまでのランダムな遅延 */
    armDelayMinMs: 200,
    armDelayMaxMs: 900,
    /** 「押すか無視するか」を決められる時間 */
    decisionWindowMs: 3200,
    /** 乗り換えた後の超短いチャレンジの長さ */
    challengeMs: 1800,
    reward: 1500,
    failReward: 0,
    bands: [
      { maxMs: 800, score: 85 },
      { maxMs: 1800, score: 60 },
    ] satisfies TimeBand[],
    fallbackScore: 35,
    /** 手放した進捗が大きいほど加算するスコア（0〜1のstakeScoreに乗算） */
    stakeScoreBonusMax: 20,
    /** 無視した（我慢できた）場合の低いドパガキスコア */
    ignoredScore: 12,
    /** stakeScoreがこの値未満なら、犯行記録は「手放した」ではなく「即乗り換え」の汎用文にする */
    lowStakeThreshold: 0.3,
  },
}
