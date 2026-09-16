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
  | 'sequenceTap'
  | 'findTarget'
  | 'releaseZone'
  | 'shortVideoSwipe'
  | 'colorWord'
  | 'flashSpot'
  | 'notifRush'
  | 'bonusTime'
  | 'arrowSwipe'
  | 'reverseArrowSwipe'
  | 'evenNumber'
  | 'popTarget'
  | 'dragGoal'
  | 'oddNumber'
  | 'fewerSide'
  | 'rps'

/**
 * お題のカテゴリ（Ver.4.2、Ver.4.5で拡張）。同じカテゴリの出題が連続しすぎないよう
 * questionPickerで参照する。
 * - reaction: 認知・反応系（見て即座に選ぶ）
 * - rapid: 高速入力系（連打）
 * - inhibition: 止まる・待つ系（衝動を抑える）
 * - visual: 視覚探索系（探して見つける）
 * - timing: タイミング系（狙った瞬間を当てる）
 * - sorting: 仕分け・選別系（対象だけを選び分ける）
 * - memory: 記憶・順序系（順番や位置を覚えて処理する）
 * - gesture: スワイプ・ドラッグ系（Ver.4.9で新設。似た操作感の問題同士が連続しすぎないよう、
 *   FoodSort/ShortVideoSwipe/ArrowSwipe/ReverseArrowSwipeを同じカテゴリにまとめた）
 */
export type QuestionCategory = 'reaction' | 'rapid' | 'inhibition' | 'visual' | 'timing' | 'sorting' | 'memory' | 'gesture'

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
    /** Ver.4.5: 信号連打で赤フェーズ中にタップしてしまった */
    redPhaseTap?: boolean
    /** Ver.4.5: 1→4などの順序お題で、順番を間違えた */
    wrongOrder?: boolean
    /** Ver.4.5: 緑で離せで、ゾーンを外れた向き（1=通り過ぎ、-1=早すぎ）とオーバー量(ms) */
    releaseOffsetMs?: number
    /** Ver.4.5: 文字の色で、文字の意味の色を選んでしまった（騙された） */
    fooledByWord?: boolean
    /** Ver.4.8: DOPA BONUS TIMEで連打できた回数（MISSが存在しないため常にcorrect:trueで使う） */
    bonusTapCount?: number
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
  /** Ver.4.5: 信号連打の赤フェーズ中に誤タップした回数の合計 */
  rapidStopRedTaps: number
  /** Ver.4.5: 「1→4」を正しく処理できた際の所要時間（直近10件） */
  sequenceTapSamples: { ms: number }[]
  /** Ver.4.5: 「ターゲットを探せ」で正解を発見した際の反応時間（直近10件、アイコン付き） */
  findTargetSamples: { icon: string; ms: number }[]
  /** Ver.4.5: 「緑で離せ」でゾーンを外した量（ms、通り過ぎ側のみ、直近10件） */
  releaseZoneOverMs: number[]
  /** Ver.4.5: 「ショート動画」3本を飛ばすのにかかった時間（直近10件） */
  shortVideoSamples: { ms: number }[]
  /** Ver.4.5: 「文字の色」で文字の意味の色を選んで騙された回数 */
  colorWordFooledCount: number
  /** Ver.4.5: 「通知ラッシュ」で規定数の赤を消すのにかかった時間（直近10件） */
  notifRushSamples: { count: number; ms: number }[]
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
  /** Ver.5.0: 120%へ到達しFINAL DOPA TRIALへ突入した場合のみ存在する進捗情報。 */
  finalTrial?: FinalTrialResultInfo
}

/**
 * Ver.5.0: FINAL DOPA TRIAL（120%到達後の16問連続正解チャレンジ）関連の型。
 * 通常の0〜100%お題（QuestionModule）とは別の、専用の問題モジュール体系を持つ。
 */
export type FinalQuestionTag = 'memory' | 'number' | 'color' | 'sequence' | 'swipe' | 'reverse' | 'inhibition' | 'math' | 'rps' | 'visual'

/** FINAL問題プールの階層。Q1-4=reversal、Q5-8=twoCondition、Q9-12=memory、Q13-15=mixed、Q16=boss（専用固定） */
export type FinalPoolTier = 'reversal' | 'twoCondition' | 'memory' | 'mixed'

export interface FinalQuestionResult {
  correct: boolean
  reactionMs: number
}

export interface FinalQuestionSpec {
  instanceId: string
  type: string
  tags: FinalQuestionTag[]
  /** 0ならtimeoutなし（FINAL QUESTIONの回答フェーズなど）。 */
  targetTimeMs: number
  data: Record<string, unknown>
}

export interface FinalQuestionComponentProps {
  spec: FinalQuestionSpec
  onResult: (result: FinalQuestionResult) => void
  /**
   * Ver.5.0追加: Preview専用（?preview=clear200）。設定されている場合、回答受付が始まった後に
   * この遅延で自動的に「正解」を選択する。本番の通常プレイからは絶対に渡されない。
   * 既存38種のFINAL問題は全てこのpropを無視する（型はオプショナルなので影響なし）。
   * 唯一FinalQuestionBoxModule（Q16）だけが、回答フェーズ開始後にこの遅延で正解の宝箱を
   * 自動選択する（本物の選択→開封演出を経由させるため、handleResultを直接呼ぶのではなく
   * 実際のUI操作と同じ内部関数を呼ぶ）。
   */
  autoSolveDelayMs?: number
}

export interface FinalQuestionModule {
  id: string
  tags: FinalQuestionTag[]
  tier: FinalPoolTier
  generate: () => Record<string, unknown>
  /** 通常のQuestionModuleと異なりフェーズのspeedMultiplierは存在しないため、最終的なms値を直接返す。 */
  computeTargetTimeMs: (data: Record<string, unknown>) => number
  Component: ComponentType<FinalQuestionComponentProps>
}

/** 結果画面用に持ち越すFINAL DOPA TRIALの進捗情報。 */
export interface FinalTrialResultInfo {
  /** 成功したFINAL問題数（0〜16）。16ならFINAL QUESTIONまで含め全問正解＝200%。 */
  trialsCleared: number
  /** FINAL QUESTION（16問目）に正解して200%へ到達したか */
  cleared200: boolean
}
