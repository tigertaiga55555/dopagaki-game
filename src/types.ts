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
  meta?: {
    /** repeatTapで指定回数を超えてタップした数など、余計な操作の回数 */
    extraTaps?: number
    /** noPress中に触れてしまった／hold前にフライングしたなど */
    forbiddenTouch?: boolean
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
  /** ベースとなる制限時間（ms）。実際はフェーズのspeedMultiplierを掛けて使う */
  baseTargetTimeMs: number
  generate: () => Record<string, unknown>
  Component: ComponentType<QuestionComponentProps>
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
