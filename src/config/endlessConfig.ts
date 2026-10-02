/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の数値ルール。
 * FINAL_TRIAL_CONFIG（120〜200%、全16問固定）とは完全に独立した別チャレンジのため、
 * 既存のFINAL_TRIAL_CONFIG.clearPercent（200）は一切変更せず、新しい設定として分離する。
 */
export const ENDLESS_CONFIG = {
  /** チャレンジ開始％（200%達成時点） */
  startPercent: 200,
  /** 正解1問ごとの上昇％ */
  correctGain: 10,
  /** MISS1回ごとの下降％ */
  missPenalty: 50,
  /**
   * 到達したら以後その値を下回らなくなるチェックポイント（％）。開始地点そのもの
   * （startPercent=200）も同じ規則で扱う「第0チェックポイント」として実装している
   * （仕様に明記のない200〜299%区間のMISS連続時の下限を、300/400と一貫する形で
   * 最も保守的に補完した。詳細は最終報告を参照）。
   */
  checkpoints: [300, 400] as const,
  /** 完全クリアとなる％ */
  clearPercent: 500,
} as const
