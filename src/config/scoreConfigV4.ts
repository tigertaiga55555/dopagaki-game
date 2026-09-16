/**
 * Ver.4.9のスコア設定。
 *
 * Ver.4.8は「0から始まる加算/減算式の累積スコア（rawScore）」を導入したが、表示上限を
 * 正答率（ACCURACY_CAPS）で直接キャップしていたため、「98%まで到達→その後数問PERFECT→
 * 正答率の母数が大きく動かない→98%から100%へ行けない」という新しい頭打ち問題が生まれた。
 *
 * Ver.4.9では正答率による直接キャップ（ACCURACY_CAPS/getAccuracyCap）を廃止する。
 * ライブスコアは1問ごとのプレイ結果（Tier×COMBO倍率×MOMENTUM倍率、MISSはカテゴリ別
 * ペナルティ）だけで動き、正答率は「OVERDRIVE eligibility」「120%の完全ノーミス条件」
 * 「結果画面のタイプ判定・コメント」にのみ使う（＝ライブスコアの直接の天井にはしない）。
 * 表示upper boundは常に100（OVERDRIVE非対象）または119/120（OVERDRIVE対象、後者は
 * ゲーム開始から一度もMISSしていない場合のみ）というeligibility由来のゲートだけになる。
 *
 * 定数はNode.jsでのモンテカルロシミュレーション（N=55問+OVERDRIVE時+8問、4000試行/ケース）
 * で検証済み。検証したケースと結果は完了報告を参照。
 */
export const SCORE_CONFIG = {
  /** ドパガキ度の表示を滑らかに増減させる時間（ms）。MISSでも急激に落ちて見えないようにする。 */
  percentTweenMs: 420,
}

/**
 * 正解時、判定Tierごとに加算する生スコア。COMBO倍率×MOMENTUM倍率が乗算される。
 * Ver.4.8比で大幅に引き上げ、1問ごとの結果がスコアに与える影響を強めた
 * （「振れ幅が小さすぎる」「普通にやると全員90%前後に収束する」への対応）。
 */
export const TIER_GAIN: Record<'PERFECT' | 'GREAT' | 'GOOD', number> = {
  PERFECT: 3.0,
  GREAT: 2.4,
  GOOD: 2.2,
}

/**
 * MISS時、理由カテゴリごとに減算する生スコア（フロアは0＝一撃で0まで落ちることはない）。
 * - timeout: 単純な反応漏れ・時間切れ（比較的軽い）
 * - wrong: 明確な誤操作・誤答（中程度）
 * - impulsive: 押すな中に押した／規定回数を超えて押したなど、衝動そのものの失敗（重め）
 * MISSは同時にCOMBO・MOMENTUMの両方をリセットするため、直接減点との「二重の痛さ」になる。
 */
export const MISS_PENALTY: Record<'timeout' | 'wrong' | 'impulsive', number> = {
  timeout: 0.8,
  wrong: 1.3,
  impulsive: 1.8,
}

/** COMBOが伸びるほど正解時の加点に乗る倍率。COMBO16で頭打ち（+16%）。 */
const COMBO_GAIN_CAP_COUNT = 16
const COMBO_GAIN_STEP = 0.01

export function comboGainMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), COMBO_GAIN_CAP_COUNT) * COMBO_GAIN_STEP
}

/**
 * Ver.4.9で新設：DOPA MOMENTUM。「終盤の連続成功」を軽く評価するための補助的な倍率。
 * 直近の正解Tierに応じて0〜1のメーターが少しずつ溜まり（PERFECTほど多く溜まる）、
 * MISSで即座に0へリセットされる。COMBOとは別軸の「最近の質の高さ」を表す。
 * MOMENTUM_MAX_BONUSは控えめ（最大+13%）にとどめ、序盤からCOMBOだけでスコアが
 * 爆発しないようにする。あくまで「98→PERFECT→99→PERFECT→100」のような終盤の
 * 逆転を後押しする補助であり、正答率が低いプレイヤーが終盤だけで100%に届く主因には
 * ならない（MISSでリセットされる＝連続して初めて効くため）。
 */
export const MOMENTUM_STEP: Record<'PERFECT' | 'GREAT' | 'GOOD', number> = {
  PERFECT: 0.16,
  GREAT: 0.08,
  GOOD: 0.03,
}
export const MOMENTUM_MAX_BONUS = 0.13

export function momentumGainMultiplier(momentum: number): number {
  return 1 + Math.max(0, Math.min(1, momentum)) * MOMENTUM_MAX_BONUS
}

export function nextMomentum(momentum: number, tier: 'PERFECT' | 'GREAT' | 'GOOD'): number {
  return Math.min(1, momentum + MOMENTUM_STEP[tier])
}

/**
 * DOPA BONUS TIME（MISSの一切ない連打ボーナス）の得点設計。
 * 「1タップ=1%」のような直接変換は絶対にせず、通常の問題1〜2問ぶん相当を上限とする、
 * firmly cappedなボーナスにする。
 */
export const BONUS_TIME_CONFIG = {
  /** これ以上のタップ数で満点ボーナス（それ未満は比例配分） */
  expectedMaxTaps: 15,
  /** 満点時に加算する生スコアの上限 */
  maxGain: 5,
}

export function computeBonusGain(tapCount: number): number {
  const ratio = Math.max(0, Math.min(1, tapCount / BONUS_TIME_CONFIG.expectedMaxTaps))
  return Math.round(ratio * BONUS_TIME_CONFIG.maxGain * 10) / 10
}

/** 反応時間 / 制限時間 の比率で判定する閾値（Ver.4.1から変更なし） */
export const JUDGE_CONFIG = {
  perfectRatio: 0.35,
  greatRatio: 0.6,
  goodRatio: 1.0,
}

/**
 * この関数は「correct:trueが確定した後の質（Tier）」を決めるためだけに呼ばれる
 * （呼び出し元は両方とも、correctがtrueの場合にしかこれを呼ばない）。Ver.4.8で
 * 発見・修正した重大バグの再発防止のため、MISSは返さずGOODを下限にする
 * （「正解かどうか」は各QuestionModule自身が既に確定させている値であり、
 * この関数の役目はあくまで質のグレーディングだけ）。
 */
export function judgeByRatio(reactionMs: number, targetTimeMs: number): 'PERFECT' | 'GREAT' | 'GOOD' {
  if (targetTimeMs <= 0) return 'GOOD'
  const ratio = reactionMs / targetTimeMs
  if (ratio <= JUDGE_CONFIG.perfectRatio) return 'PERFECT'
  if (ratio <= JUDGE_CONFIG.greatRatio) return 'GREAT'
  return 'GOOD'
}
