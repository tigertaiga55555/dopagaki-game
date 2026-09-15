import type { ComponentType } from 'react'

export type ScreenName = 'title' | 'playing' | 'result'

export type Judgement = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'

export type QuestionTypeId =
  | 'color'
  | 'oddOneOut'
  | 'maxNumber'
  | 'minNumber'
  | 'differentOne'
  | 'sameOne'
  | 'moreSide'
  | 'biggerShape'
  | 'simpleMath'
  | 'swipe'
  | 'repeatTap'
  | 'holdPress'
  | 'noPress'
  | 'goWait'
  | 'skipWait'
  | 'rapidStop'
  | 'stopAt100'
  | 'clearNotifications'
  | 'spotChange'
  | 'foodSort'

/**
 * お題のカテゴリ（Ver.4.2）。同じカテゴリの出題が連続しすぎないよう
 * questionPickerで参照する。
 * - reaction: 認知・反応系（見て即座に選ぶ）
 * - rapid: 高速入力系（連打）
 * - inhibition: 止まる・待つ系（衝動を抑える）
 * - visual: 視覚探索系（探して見つける）
 * - timing: タイミング系（狙った瞬間を当てる）
 */
export type QuestionCategory = 'reaction' | 'rapid' | 'inhibition' | 'visual' | 'timing'

export type DifficultyPhaseId = 'warmup' | 'ramp' | 'fake' | 'boost' | 'overload' | 'finalRush'

/** 1問ぶんの出題データ。type固有の内容はdataに詰める。 */
export interface QuestionSpec {
  instanceId: string
  type: QuestionTypeId
  targetTimeMs: number
  data: Record<string, unknown>
}

/** 1問終了時にエンジンへ返す結果 */
export interface QuestionResult {
  correct: boolean
  /** 出題からの反応時間（ms）。hold/noPressなど「速さ」で測れない問題は0や固定値でよい。 */
  reactionMs: number
  /** 通常はreactionMs/targetTimeMsの比率で判定するが、明示的にtierを指定したい問題用 */
  tierOverride?: Judgement
  /**
   * 反応比率（PERFECT/GREAT/GOOD判定・OVERDRIVEの反応速度評価）の分母として
   * spec.targetTimeMsの代わりに使う値（ms）。GOやSKIPのように「出題開始〜反応」ではなく
   * 「合図が出てから反応」など特定区間の速さで公平に評価したい問題用。省略時はspec.targetTimeMsを使う。
   */
  ratioWindowMs?: number
  meta?: {
    /** repeatTap/rapidStopで指定回数・停止確認を超えて余計にタップした回数 */
    extraTaps?: number
    /** noPress中に触れてしまった／hold前にフライングしたなど */
    forbiddenTouch?: boolean
    /** GO/SKIP/変わったやつなどで、合図より前にフライングした */
    earlyPress?: boolean
    /** 「100で止めろ」で実際に停止した値 */
    stoppedAtValue?: number
    /** 「通知を消せ」で消せた対象数と対象総数 */
    targetsCleared?: number
    targetsTotal?: number
  }
}

export interface QuestionComponentProps {
  spec: QuestionSpec
  /** 演出レベル（0〜5）。問題側の派手さ調整に使ってよい */
  visualLevel: number
  onResult: (result: QuestionResult) => void
}

export interface QuestionModule {
  id: QuestionTypeId
  /** お題のカテゴリ。questionPickerが同カテゴリの連続出題を避けるのに使う。 */
  category: QuestionCategory
  /** ベースとなる制限時間（ms）。実際はフェーズのspeedMultiplierを掛けて使う */
  baseTargetTimeMs: number
  generate: () => Record<string, unknown>
  Component: ComponentType<QuestionComponentProps>
  /**
   * 生成したdataから「これ以上は絶対に短くしてはいけない」制限時間を返す（任意）。
   * 実際のtargetTimeMsは max(baseTargetTimeMs×speedMultiplier, この値) になる。
   * HOLDの必要保持時間や連打の必要回数など、速度倍率だけでは表現できない
   * 物理的な下限がある問題タイプはこれを実装する。
   */
  computeMinTargetTimeMs?: (data: Record<string, unknown>) => number
}

export interface DopagakiTypeDef {
  id: string
  name: string
}

/** 1プレイの統計ログ。犯行記録・タイプ判定・OVERDRIVE判定に使う。 */
export interface PlayStats {
  totalAnswered: number
  correctCount: number
  missCount: number
  maxCombo: number
  reactionSamples: { type: QuestionTypeId; reactionMs: number; targetTimeMs: number; correct: boolean }[]
  fastestReactionMs: number | null
  noPressTotal: number
  noPressFails: number
  hastyTapCount: number
  maxTapsInOneSecond: number
  comboLostToNoPress: number
  /** 問題タイプ別の成績。タイプ判定（連打が強い／スワイプが強い等）に使う。 */
  typeStats: Partial<Record<QuestionTypeId, { correct: number; total: number }>>
  /** GO/SKIP/変わったやつなどで合図より前にフライングした回数の合計（将来の待てない型判定・犯行記録用） */
  earlyPressCount: number
  /** repeatTap/rapidStopで指定回数・停止確認を超えて余計に押した回数の合計 */
  overPressCount: number
  /** 「100で止めろ」の記録（直近10件まで保持） */
  stopAt100Samples: { stopped: number; diff: number }[]
  /** 「通知を消せ」の記録（直近10件まで保持） */
  notificationClearSamples: { count: number; ms: number }[]
}

export interface FinalResultV4 {
  percent: number
  rawPercent: number
  overdriveActive: boolean
  type: DopagakiTypeDef
  comment: string
  crimeRecords: string[]
  maxCombo: number
  fastestReactionMs: number | null
  accuracy: number
  isFirstPlay: boolean
  isNewBest: boolean
  bestPercent: number
  playCount: number
}
