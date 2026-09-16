/**
 * Ver.4.8のスコア設定。
 *
 * Ver.4.1〜4.7は「1問ごとの質スコア（0〜100、MISSは0）の平均」だった。平均モデルは
 * 出題数で薄まる問題は解決したが、別の問題を生んだ：最初の1問がPERFECT（=100点）なら、
 * その時点でaverageが100になり、「始まった瞬間にドパガキ度が高く見える」という
 * ユーザー報告どおりの状態になっていた。
 *
 * Ver.4.8では平均モデルをやめ、0から始まる加算/減算式の累積スコア（rawScore）に変更する。
 * 正解するたびに判定Tier×COMBO倍率ぶん加点し、MISSするたびに理由別ペナルティで減点する
 * （フロアは0）。表示上限（ドパガキ度の見た目）は正答率に応じたACCURACY_CAPSを
 * 「その時点のrawScoreに被せるだけ」で実現し、rawScore自体は上限を超えて溜まっていてもよい
 * ――正答率が後で上がればcapも上がり、蓄積していたrawScoreが自然に表に出てくる。
 *
 * 定数はNode.jsでのモンテカルロシミュレーション（N=55問/ゲーム、4000試行/ケース）で
 * 検証済み。検証したケースと結果は完了報告を参照。
 */
export const SCORE_CONFIG = {
  /** ドパガキ度の表示を滑らかに増減させる時間（ms）。MISSでも急激に落ちて見えないようにする。 */
  percentTweenMs: 420,
}

/**
 * 正解時、判定Tierごとに加算する生スコア。COMBO倍率（comboGainMultiplier）が乗算される。
 * GOOD/GREAT/PERFECTの差を大きくしすぎないのは、正答率（＝MISSしない比率）を
 * ドパガキ度の主要因にしつつ、判定の速さは上振れの副次要素として効かせるため。
 */
export const TIER_GAIN: Record<'PERFECT' | 'GREAT' | 'GOOD', number> = {
  PERFECT: 4.4,
  GREAT: 3.4,
  GOOD: 2.4,
}

/**
 * MISS時、理由カテゴリごとに減算する生スコア（フロアは0＝一撃で0まで落ちることはない）。
 * - timeout: 単純な反応漏れ・時間切れ（比較的軽い）
 * - wrong: 明確な誤操作・誤答（中程度）
 * - impulsive: 押すな中に押した／規定回数を超えて押したなど、衝動そのものの失敗（重め）
 */
export const MISS_PENALTY: Record<'timeout' | 'wrong' | 'impulsive', number> = {
  timeout: 0.9,
  wrong: 1.6,
  impulsive: 2.4,
}

/** COMBOが伸びるほど正解時の加点に乗る倍率。COMBO20で頭打ち（+40%）にし、序盤の暴騰を防ぐ。 */
const COMBO_GAIN_CAP_COUNT = 20
const COMBO_GAIN_STEP = 0.02

export function comboGainMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), COMBO_GAIN_CAP_COUNT) * COMBO_GAIN_STEP
}

/**
 * DOPA BONUS TIME（MISSの一切ない連打ボーナス）の得点設計。
 * 「1タップ=1%」のような直接変換は絶対にせず、通常の問題1〜2問ぶん相当（TIER_GAIN.PERFECTの
 * 約1.6倍）を上限とする、firmly cappedなボーナスにする。
 */
export const BONUS_TIME_CONFIG = {
  /** これ以上のタップ数で満点ボーナス（それ未満は比例配分） */
  expectedMaxTaps: 15,
  /** 満点時に加算する生スコアの上限 */
  maxGain: 7,
}

export function computeBonusGain(tapCount: number): number {
  const ratio = Math.max(0, Math.min(1, tapCount / BONUS_TIME_CONFIG.expectedMaxTaps))
  return Math.round(ratio * BONUS_TIME_CONFIG.maxGain * 10) / 10
}

/**
 * 正答率によるドパガキ度の上限（OVERDRIVE非対象時のみ適用）。
 * rawScoreがどれだけ溜まっていても、表示は「その時点の正答率のcap」までしか出さない。
 * 上から順に評価し、最初に条件を満たした行のcapを採用する。
 *
 * シミュレーション結果（60/70/80/90/95%accuracyケース）に基づき調整済み：
 * 60〜70%の正答率では絶対に100%へ到達しない一方、90%台前半＋高速＋高COMBOなら
 * 100%到達が現実的に狙える範囲になっている。
 */
export const ACCURACY_CAPS: { minAccuracy: number; cap: number }[] = [
  { minAccuracy: 0.95, cap: 100 },
  { minAccuracy: 0.9, cap: 98 },
  { minAccuracy: 0.85, cap: 94 },
  { minAccuracy: 0.8, cap: 88 },
  { minAccuracy: 0.7, cap: 76 },
  { minAccuracy: 0.6, cap: 65 },
  { minAccuracy: 0, cap: 50 },
]

export function getAccuracyCap(accuracy: number): number {
  for (const tier of ACCURACY_CAPS) {
    if (accuracy >= tier.minAccuracy) return tier.cap
  }
  return ACCURACY_CAPS[ACCURACY_CAPS.length - 1].cap
}

/** 反応時間 / 制限時間 の比率で判定する閾値（Ver.4.1から変更なし） */
export const JUDGE_CONFIG = {
  perfectRatio: 0.35,
  greatRatio: 0.6,
  goodRatio: 1.0,
}

/**
 * Ver.4.8で発見・修正した重大バグ：この関数は「correct:trueが確定した後の質（Tier）」を
 * 決めるためだけに呼ばれる（呼び出し元は両方とも、correctがtrueの場合にしかこれを呼ばない）。
 * にもかかわらず、以前はratioが1.0を超えると'MISS'を返しており、正解として確定した
 * 判定を静かに'MISS'へ書き換えてしまっていた（少し時間がかかっただけの正解が、
 * 表示上・スコア上は「不正解」として扱われる、というバグ）。
 * 「正解かどうか」は各QuestionModule自身が既に確定させている値であり、この関数の役目は
 * あくまで質のグレーディングだけなので、MISSは返さずGOODを下限にする。
 */
export function judgeByRatio(reactionMs: number, targetTimeMs: number): 'PERFECT' | 'GREAT' | 'GOOD' {
  if (targetTimeMs <= 0) return 'GOOD'
  const ratio = reactionMs / targetTimeMs
  if (ratio <= JUDGE_CONFIG.perfectRatio) return 'PERFECT'
  if (ratio <= JUDGE_CONFIG.greatRatio) return 'GREAT'
  return 'GOOD'
}
