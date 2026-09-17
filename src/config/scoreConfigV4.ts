/**
 * Ver.4.10のスコア設定。
 *
 * Ver.4.9で「正答率による直接キャップ」は廃止したが、実際にシミュレーションすると
 * スコアが全体的に高すぎた（80%正答で平均97.4%など）。「普通にやれば90%前後へ収束」を
 * 「結果が大きく振れる」へ変える、という本来の目的からズレていたため、Ver.4.10で
 * TIER_GAIN・MISS_PENALTY・COMBO倍率・MOMENTUM倍率の4つをセットで再調整した。
 *
 * 設計上の制約（シミュレーションで判明した数学的な事実）：
 * 1ゲームの出題数はおよそ50〜60問。この規模で「MISSペナルティを明確に強める」
 * （ユーザー希望：timeout -2〜3 / wrong -3〜5 / impulsive -4〜6 程度）と
 * 「正答率50%でも25〜45%は残る」を同時に、加点・減点が完全に一定（COMBO/MOMENTUM
 * 以外は毎回同じ値）の単純な足し算モデルだけで満たすことはできない
 * （50%正答なら約27〜28回はMISSするため、ペナルティが本当にその大きさだと
 * 正答ぶんの加点をほぼ相殺してしまう）。
 *
 * そこでVer.4.10では、Ver.4.9までの「TIER_GAIN／MISS_PENALTY／COMBO倍率／MOMENTUM倍率」
 * の4つに加えて、次の2つを導入した：
 * - COMBO_LOSS: MISSした瞬間の「切れたCOMBOの大きさ」に応じてペナルティを上乗せする。
 *   正答率が低いプレイヤーはCOMBOが伸びる前にすぐMISSするため実質的な影響が小さく、
 *   正答率が高いプレイヤーほど「大きく育てたCOMBOを失う」実質ペナルティが重くなる
 *   （＝MISSの基本値は抑えめでも、COMBOがある状態でのMISSは合計でユーザー希望の
 *   2〜6の範囲に達する。詳細は完了報告を参照）。
 * - DIMINISHING_RETURNS: rawScore自体（＝プレイヤーの実績）が一定水準を超えた後は、
 *   同じ判定でも加点が少しずつ小さくなる。正答率ではなく「その時点のrawScoreの値」
 *   だけで決まるため、「正答率を直接の天井にしない」という方針には反しない。
 *   出題数が多い高正答率プレイヤーほど早くこの領域に入るため、「80〜90%正答なら
 *   楽に100へ近づく」を防ぎつつ、低正答率プレイヤーの加点は目減りしない。
 *
 * 定数はNode.jsでのモンテカルロシミュレーション（N=55問+OVERDRIVE時+8問、
 * 4000試行/ケース）で検証済み。検証したケースと結果は完了報告を参照。
 */
export const SCORE_CONFIG = {
  /** ドパガキ度の表示を滑らかに増減させる時間（ms）。MISSでも急激に落ちて見えないようにする。 */
  percentTweenMs: 420,
}

/**
 * 正解時、判定Tierごとに加算する生スコア。COMBO倍率×MOMENTUM倍率×
 * DIMINISHING_RETURNS倍率が乗算される。
 */
export const TIER_GAIN: Record<'PERFECT' | 'GREAT' | 'GOOD', number> = {
  PERFECT: 4.3,
  GREAT: 3.5,
  GOOD: 3.1,
}

/**
 * MISS時、理由カテゴリごとに減算する生スコアの基本値（フロアは0＝一撃で0まで落ちない）。
 * - timeout: 単純な反応漏れ・時間切れ（比較的軽い）
 * - wrong: 明確な誤操作・誤答（中程度）
 * - impulsive: 押すな中に押した／規定回数を超えて押したなど、衝動そのものの失敗（重め）
 * 実際に減算される値はこれに COMBO_LOSS（下記）が加算される。COMBO0でのMISS
 * （平均1.5/2.1/3.1、平均2.23）はVer.4.8（平均1.63）より明確に強いが、Ver.4.9
 * （平均1.37）よりさらに強めている。COMBOが育った状態でのMISSは、COMBO_LOSSの
 * 上乗せによりユーザー希望の2〜6の範囲（timeout約2〜4、wrong約3〜5、impulsive約4〜6）
 * に達する。
 */
export const MISS_PENALTY: Record<'timeout' | 'wrong' | 'impulsive', number> = {
  timeout: 1.5,
  wrong: 2.1,
  impulsive: 3.1,
}

/**
 * MISSした瞬間のCOMBO数に応じて基本ペナルティへ上乗せする追加減点。
 * 「大きく育てたCOMBOを失うMISSほど痛い」を数値としても表現する。
 */
const COMBO_LOSS_FACTOR = 0.22
const COMBO_LOSS_CAP = 4.0

export function comboLossPenalty(comboAtMiss: number): number {
  return Math.min(COMBO_LOSS_CAP, Math.max(0, comboAtMiss) * COMBO_LOSS_FACTOR)
}

/** COMBOが伸びるほど正解時の加点に乗る倍率。COMBO14で頭打ち（+7%）。Ver.4.9より控えめにし、単独でのスコア暴騰を防ぐ。 */
const COMBO_GAIN_CAP_COUNT = 14
const COMBO_GAIN_STEP = 0.005

export function comboGainMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), COMBO_GAIN_CAP_COUNT) * COMBO_GAIN_STEP
}

/**
 * DOPA MOMENTUM。「終盤の連続成功」を軽く評価するための補助的な倍率。
 * 直近の正解Tierに応じて0〜1のメーターが少しずつ溜まり（PERFECTほど多く溜まる）、
 * MISSで即座に0へリセットされる。COMBOとは別軸の「最近の質の高さ」を表す。
 * MOMENTUM_MAX_BONUSはVer.4.9よりさらに控えめ（最大+4%）にし、序盤からCOMBOと
 * 合わせてスコアが爆発しないようにする。あくまで「98→PERFECT→99→PERFECT→100」の
 * ような終盤の逆転を後押しする補助であり、正答率が低いプレイヤーが終盤だけで
 * 100%に届く主因にはならない（MISSでリセットされる＝連続して初めて効くため）。
 */
export const MOMENTUM_STEP: Record<'PERFECT' | 'GREAT' | 'GOOD', number> = {
  PERFECT: 0.1,
  GREAT: 0.05,
  GOOD: 0.02,
}
export const MOMENTUM_MAX_BONUS = 0.04

export function momentumGainMultiplier(momentum: number): number {
  return 1 + Math.max(0, Math.min(1, momentum)) * MOMENTUM_MAX_BONUS
}

export function nextMomentum(momentum: number, tier: 'PERFECT' | 'GREAT' | 'GOOD'): number {
  return Math.min(1, momentum + MOMENTUM_STEP[tier])
}

/**
 * Ver.4.10で新設：DIMINISHING_RETURNS（逓減）。rawScoreがDIM_THRESHOLDを超えた後、
 * 同じ判定でも加点が少しずつ小さくなる（下限floorで頭打ち）。あくまでプレイヤー
 * 自身の「その時点のrawScore」だけで決まる値ベースの仕組みであり、正答率を直接の
 * 天井にするものではない（正答率が低いプレイヤーはrawScoreが伸びにくいためこの領域に
 * 入りにくく、加点は目減りしない）。
 *
 * Ver.4.11（OVERDRIVE高得点帯バランス調整）：0〜99%の間はDIM_FLOOR_NORMAL（従来の0.3）を
 * 維持し、「100%到達までの難易度」には一切手を加えない。しかしOVERDRIVE突入後
 * （rawScore>=100）まで同じ強いブレーキをかけ続けると、「限界突破したのにスコアが
 * ほとんど伸びない」状態になる（実ユーザーテストで正答率100%・最大COMBO49・
 * 最速反応0.43秒という非常に高品質なノーミスプレイでも108%止まりだった主因）。
 * 「100%＝LIMIT BREAK」という世界観に合わせ、OVERDRIVE中はfloorを明確に緩和する。
 * さらにゲーム開始から一度もMISSしていない場合（120%候補）は、MISS経験ありより
 * さらに緩和する（ただし正答率100%＝自動120%にはしない。追加10秒中のPERFECT/GREAT比率・
 * COMBO・反応速度次第で115〜120に分かれる程度に留める）。定数はNode.jsでの
 * モンテカルロシミュレーション（rawScore=100到達後、追加10秒ぶんの問題を4000試行/ケースで
 * 検証）で決定した。詳細は完了報告を参照。
 */
const DIM_THRESHOLD = 30
const DIM_SLOPE = 0.011
const DIM_FLOOR_NORMAL = 0.3
/** OVERDRIVE中（rawScore>=100）かつ一度でもMISSしている場合のfloor */
const DIM_FLOOR_OVERDRIVE_MISS = 0.55
/** OVERDRIVE中（rawScore>=100）かつゲーム開始から完全ノーミスの場合のfloor（120%候補への評価） */
const DIM_FLOOR_OVERDRIVE_NO_MISS = 0.63

/**
 * floorは呼び出し元（useRushGame.ts）がOVERDRIVE突入状態・MISS経験の有無に応じて
 * 明示的に渡す。省略時（0〜99%の通常プレイ）は従来通りDIM_FLOOR_NORMALを使う。
 */
export function diminishingReturnsMultiplier(currentRawScore: number, floor: number = DIM_FLOOR_NORMAL): number {
  if (currentRawScore <= DIM_THRESHOLD) return 1
  const reduced = 1 - (currentRawScore - DIM_THRESHOLD) * DIM_SLOPE
  return Math.max(floor, reduced)
}

/**
 * OVERDRIVE中のDIMINISHING_RETURNS floorを、突入状態とMISS経験の有無から決定する。
 * OVERDRIVEへ突入していない（rawScore<100）場合はundefinedを返し、呼び出し元は
 * diminishingReturnsMultiplier()のデフォルト（DIM_FLOOR_NORMAL）にフォールバックする。
 */
export function getDiminishingReturnsFloor(overdriveActive: boolean, hasEverMissed: boolean): number | undefined {
  if (!overdriveActive) return undefined
  return hasEverMissed ? DIM_FLOOR_OVERDRIVE_MISS : DIM_FLOOR_OVERDRIVE_NO_MISS
}

/**
 * DOPA BONUS TIME（MISSの一切ない連打ボーナス）の得点設計。
 * Ver.5.0追加修正: 「2タップで+1%、最大+10%」の明確な段階式に変更（ユーザー指定）。
 * 0〜1タップ=+0%、2〜3タップ=+1%、4〜5タップ=+2%……20タップ以上で上限の+10%に達する。
 * BonusTimeQuestion.tsx側もこの関数をそのまま使い、タップ数から見せる%表示を計算する
 * （得点の実装が2箇所に分かれて数値がズレることを防ぐ）。
 */
export const BONUS_TIME_CONFIG = {
  /** この人数のタップごとに+1% */
  tapsPerPercent: 2,
  /** 加算する生スコア（％）の上限 */
  maxGain: 10,
}

export function computeBonusGain(tapCount: number): number {
  return Math.min(BONUS_TIME_CONFIG.maxGain, Math.floor(tapCount / BONUS_TIME_CONFIG.tapsPerPercent))
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
