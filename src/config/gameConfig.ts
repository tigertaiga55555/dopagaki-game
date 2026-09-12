/**
 * ゲームバランス調整用の設定ファイル。
 * ここの数値・確率を変えるだけでゲーム全体の体感を調整できる。
 */

export const GAME_CONFIG = {
  /** 開始ポイント */
  startPoint: 10,

  /** プレイヤーに知らせない最大プレイ時間（ms）。これを超えると自動確定になる */
  maxDurationMs: 90_000,

  /** 自動確定時にかかるボーナス倍率 */
  autoEndBonusMultiplier: 1.2,

  /** 序盤（上昇のみを見せるフェーズ）の進行度しきい値（0〜1） */
  earlyPhaseEnd: 0.2,

  /** 「初めての暴落」を必ず起こす進行度の範囲（0〜1） */
  firstCrashWindow: [0.22, 0.38] as [number, number],

  /** 終盤（大勝負フェーズ）が始まる進行度 */
  latePhaseStart: 0.85,

  /**
   * 上昇系イベントの「振れ幅の基準値（amplitude）」。
   * 進行度（0〜1）に応じて startPoint 〜 amplitudeCap の間で増えていく。
   * 上昇量はこの基準値に対する比率で決まるため、現在ポイントに対する倍率では増減させない
   * （倍率にすると複利的に指数爆発してランク上限が意味をなさなくなるため）。
   * 暴落・じわじわ下落だけは「今持っている分の何割を失うか」という比率（現在値に対する倍率）で表現する。
   */
  amplitudeCap: 4200,

  /** 何もスクリプトイベントが無いステップで、あおりメッセージを出す確率 */
  tauntChancePerStep: 0.55,

  /** 演出・数値変化のアニメーション速度に関する基準値（ms） */
  timing: {
    riseStep: 550,
    bigStep: 700,
    plateauStep: 450,
    countdownStep: 550,
    resolveStep: 750,
  },

  /** 中盤〜終盤で使うイベント種別ごとの抽選重み */
  midPhaseWeights: {
    riseNormal: 5,
    riseBig: 2,
    crash: 3,
    crashSlow: 2,
    plateau: 2,
    crashRecover: 1,
    fakePeak: 2,
    inflation: 1,
    fakeBonus: 2,
    mysteryCountdown: 1,
    flatBonus: 2,
  },

  /** 終盤クライマックスで「大勝負」を起こす確率（起こらない場合は通常抽選を継続） */
  climaxEventChance: 0.6,
  /** 終盤の大勝負で上振れ（急上昇/インフレ）になる確率。残りは暴落 */
  climaxUpChance: 0.5,

  /**
   * 各イベントの変化量レンジ。
   * ratioMin/ratioMax は「基準値（amplitude）に対する比率」の加算（上昇系）。
   * min/max は「現在ポイントに対する倍率」（下落系はこちら＝現在値の何割になるか）。
   */
  events: {
    riseNormal: { ratioMin: 0.1, ratioMax: 0.26 },
    riseBig: { ratioMin: 0.35, ratioMax: 0.7 },
    crash: { min: 0.15, max: 0.35 },
    crashSlow: { stepMin: 0.85, stepMax: 0.95, steps: 4 },
    crashRecoverUp: { ratioMin: 0.3, ratioMax: 0.55, steps: 3 },
    inflation: { ratioMin: 0.25, ratioMax: 0.5, steps: 5 },
    fakePeak: { ratioMin: 0.15, ratioMax: 0.3 },
    flatBonus: { ratioMin: 0.2, ratioMax: 0.45, minPoints: 50 },
    fakeBonus: {
      doubleWeight: 45,
      nothingWeight: 35,
      dropWeight: 20,
      dropMin: 0.4,
      dropMax: 0.6,
    },
  },

  /** ポイントの絶対上限（暴走防止のセーフティネット） */
  pointHardCap: 15000,

  /** ドパガキ度の算出に使う上限ポイント（これ以上は0%に近づく） */
  dopagakiPercentCap: 5000,
  dopagakiPercentMin: 2,
  dopagakiPercentMax: 98,

  /** 「欲張った」とみなす、最高到達とのギャップの割合しきい値 */
  greedRatioThreshold: 0.15,
  greedPointThreshold: 150,

  shareUrl: 'https://dopagaki-game.example.com',
}

export type GameConfig = typeof GAME_CONFIG
