/**
 * Ver.6 Phase 1（再設計版）: 200〜500%「LIMIT BREAK」チャレンジの数値ルール。
 * FINAL_TRIAL_CONFIG（120〜200%、全16問固定）とは完全に独立した別チャレンジのため、
 * 既存のFINAL_TRIAL_CONFIG.clearPercent（200）は一切変更せず、新しい設定として分離する。
 *
 * 200%を突破した上級者だけが挑む領域として再設計し、MISSペナルティ・下線反転の
 * 出現比率・問題ごとの制限時間をすべて実機QAで調整できる定数として1箇所に集約する
 * （ユーザー指示: 「数値は実機QA後に調整するため、必ず設定値として分離してください」）。
 */
export const CHALLENGE500_CONFIG = {
  /** チャレンジ開始％（200%達成時点） */
  startPercent: 200,
  /** 正解1問ごとの上昇％ */
  correctGain: 10,
  /**
   * 到達したら以後その値を下回らなくなるチェックポイント（％）。開始地点そのもの
   * （startPercent=200）も同じ規則で扱う「第0チェックポイント」として実装している
   * （200〜299%区間のMISS連続時の下限を、300/400と一貫する形で最も保守的に補完した）。
   */
  checkpoints: [300, 400] as const,
  /** 完全クリアとなる％ */
  clearPercent: 500,

  /**
   * tier別MISSペナルティ（QA初期値）。tier3（400〜499%）はペナルティ％ではなく
   * 「1 MISSで即終了・400%へ戻る」という別ルールのため、ここには含めない
   * （tierForPercentとapplyMiss内のtier3分岐を参照）。
   * 例: 390(tier2)→MISS→320（続行）/ 350(tier2)→MISS→300にクランプ（終了）。
   */
  missPenaltyTier1: 50,
  missPenaltyTier2: 70,

  /**
   * 全tier・全問題タイプ共通の制限時間（ms、QA初期値）。「読めるが余裕はない」程度を想定。
   * ユーザー指示により、問題の複雑さやtierによる時間調整は一切行わない
   * （時間短縮ではなく問題自体の難しさ・反転・複数条件で難易度を作るため）。
   * 時間切れは各tierの現在のMISSペナルティ（tier3なら即終了）がそのまま適用される。
   */
  questionTimeLimitMs: 4500,
} as const

export type Challenge500Tier = 1 | 2 | 3

/** 200〜299%=tier1（反転0〜1箇所）、300〜399%=tier2（反転0〜2箇所）、400%以上=tier3（反転0〜2箇所＋複数条件、MISS即終了）。 */
export function tierForPercent(percent: number): Challenge500Tier {
  if (percent < 300) return 1
  if (percent < 400) return 2
  return 3
}

/**
 * 各tierでの「下線反転の個数」出現比率（重み、QA初期案）。
 * 0=反転なし問題（文章どおりに解く）、1=反転1箇所、2=反転2箇所。
 * ユーザー指示により、tierが上がるほど機械的に「反転の個数」を増やすのではなく、
 * 常に反転なし問題を一定割合で混在させる（「どうせ反対」と構えさせないため）。
 * 各問題テンプレートは自身が対応できる最大反転数（maxInversionSlots）でこの抽選結果を
 * clampするため、tier1のみの問題で2が出ても安全に0/1へ縮退する。
 */
export const CHALLENGE500_INVERSION_WEIGHTS: Record<Challenge500Tier, { 0: number; 1: number; 2: number }> = {
  1: { 0: 35, 1: 65, 2: 0 },
  2: { 0: 35, 1: 40, 2: 25 },
  3: { 0: 35, 1: 40, 2: 25 },
}
