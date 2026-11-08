import type { ComponentType } from 'react'

export type ScreenName =
  | 'title'
  | 'playing'
  | 'result'
  | 'endlessSelect'
  | 'endlessPlaying'
  | 'endlessResult'
  | 'profile'
  | 'profileEdit'
  | 'achievements'
  | 'ranking'
  | 'challengeReceive'
  | 'challengeSent'
  | 'challengePlaying'
  | 'challengeResult'
  | 'challengeHistory'
  | 'challengeSentList'

/**
 * Ver.6 Phase 4: Endlessモードの難易度。既存通常ゲームの問題難易度システム
 * （config/difficultyConfig.tsのDIFFICULTY_PHASES）を再利用するための3段階のラベルで、
 * Endless専用の新しい難易度分類ではない（config/endlessConfig.ts参照）。
 */
export type EndlessDifficulty = 'beginner' | 'intermediate' | 'advanced'

/**
 * Ver.6 Phase 4: 将来のオンラインランキング（Endless 初級/中級/上級の3種類）との互換性のため、
 * 1プレイぶんの記録をこの形に揃えておく。現段階ではlocalStorageの自己ベストにしか
 * 使わないが、difficulty/score/playedAtというフィールド構成自体は、将来DBへ送る
 * レコードとしてもそのまま使える形にしてある（DB/Supabase等は今回導入しない）。
 */
export interface EndlessRecord {
  difficulty: EndlessDifficulty
  score: number
  playedAt: number
}

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
  /**
   * Ver.6 Phase 5.3（Challenge勝敗判定強化）: DOPA BONUS TIME（bonusTime問題）で
   * rawScoreへ加算された量の合計（通常は1ゲーム1回ぶんのみ）。Challenge用の
   * 「通常獲得DOPA%」（最終DOPA%からボーナスタイム分を除いた値）を正確に算出するために
   * 追加した。既存の最終DOPA%（finalPercent/percent）の計算には一切影響しない
   * （rawScoreRef自体への加算ロジックは無変更、この値は別途記録するだけ）。
   */
  bonusGainRaw: number
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
  /** Ver.6 Phase 1: 200%到達後、限界突破チャレンジ（200〜500%）に挑戦した場合のみ存在する。 */
  challenge500?: Challenge500ResultInfo
  /**
   * Ver.6 Phase 5: 今回のプレイで新たに解除されたDOPA%実績（0件なら空配列）。
   * 300/400チェックポイント・490 FINAL QUESTION・500 CLEAR等の既存演出と競合しないよう、
   * ゲーム中には出さず結果画面でまとめて通知する（screens/ResultScreen.tsx参照）。
   */
  newlyUnlockedAchievements?: AchievementId[]
  /**
   * Ver.6 Phase 5.2（Challenge機能完成）: このプレイで実際に出題された問題列。
   * 結果画面の「挑戦状を送る」がこれをそのままChallengeのproblemSetとして送信する
   * （未定義または空配列なら「挑戦状を送る」ボタン自体を表示しない）。
   */
  recordedProblemSet?: ChallengeProblemSetItem[]
  /**
   * Ver.6 Phase 5.3（Challenge勝敗判定強化）: Challengeの作成・挑戦のどちらでも使う
   * 比較用performance。recordedProblemSetと同じく、未定義なら「挑戦状を送る」ボタンは
   * 表示されない（createChallengeFromResult.ts参照）。通常結果画面（screens/
   * ResultScreen.tsx）はこのフィールドを一切読まないため、表示内容に影響しない。
   */
  challengePerformance?: ChallengePerformance
}

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: Challengeの勝敗を「最終DOPA%が同じなら即LOSE」
 * ではなく、複数指標の優先順位で決める——その比較に使う1プレイぶんの記録。
 * Challenge作成時（作成者の基準記録）・attempt送信時（挑戦者自身の記録）の両方で
 * このインターフェースをそのまま使う。
 */
export interface ChallengePerformance {
  /** 最終DOPA%（既存のFinalResultV4.percentと同じ値）。 */
  finalDopaPercent: number
  /**
   * 通常獲得DOPA%。最終DOPA%からボーナスタイム等で追加された分を除いた値。
   * 通常プレイ（0〜120%）はPlayStats.bonusGainRawを除いた値、FINAL DOPA TRIAL・
   * 限界突破チャレンジにはボーナス機構自体が存在しないため最終DOPA%と同値になる
   * （engine/resultEngineV4.ts参照）。
   */
  baseDopaPercent: number
  /** 正答率（0〜1）。 */
  accuracy: number
  /** 最大COMBO（連続正解数）。 */
  maxCombo: number
  /**
   * 正解した問題だけのreaction time（ms）一覧の中央値。比較可能な正解サンプルが
   * 一度も無かった場合はnull（例: 1問も答えずに終了した等の極端なケース）。
   */
  medianCorrectReactionMs: number | null
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: 出題された1問を再現するための最小限の情報。
 * src/challenge/types.tsのChallengeProblemSetItemと同一の型をここで定義し、
 * challenge/types.ts側はこれをそのまま再利用する（types.ts→challenge/types.tsの
 * 一方向依存を保ち、循環importを避けるため）。既存の3つの問題体系
 * （QuestionSpec／FinalQuestionSpec／Challenge500QuestionSpec）はいずれも
 * {type, data} を核に持つ（targetTimeMs・tagsは体系によって有無が異なる）ため、
 * その共通部分だけを持つ。
 */
export interface ChallengeProblemSetItem {
  type: string
  targetTimeMs?: number
  tags?: string[]
  data: Record<string, unknown>
}

/** Ver.6 Phase 1: 結果画面用に持ち越す限界突破チャレンジ（200〜500%）の進捗情報。 */
export interface Challenge500ResultInfo {
  /** 確保済みの最高チェックポイント（200/300/400/500）。 */
  floor: number
  /** 500%まで完全クリアしたか。 */
  cleared: boolean
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

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: 匿名プレイヤーID。ログイン不要の
 * まま、同一ブラウザ内でプレイヤーを識別するためだけの値（個人情報は含まない）。
 * crypto.randomUUID()等の衝突しにくい形式で生成し、一度生成したら
 * localStorage（utils/profileStorage.ts）へ保存してブラウザを閉じても維持する。
 * 将来のDOPA PASS購入・Google/Email認証導入時は、このIDをそのままアカウントへ
 * 紐付ける鍵として使う想定（storageへ密結合しすぎない構造にするため、型としては
 * ただのstringで扱う）。
 */
export type PlayerId = string

/**
 * Ver.6 Phase 5.1（icon拡充）: プロフィールアイコン。外部画像は使わず、既存のemoji
 * 24種から選ぶだけ。既存8種（bolt〜gem）のidは互換性維持のため一切変更していない。
 */
export type PresetIconId =
  // ネオン系（既存8種、Ver.6 Phase 5からそのまま）
  | 'bolt'
  | 'flame'
  | 'skull'
  | 'eye'
  | 'swirl'
  | 'star'
  | 'crown'
  | 'gem'
  // 顔
  | 'devil'
  | 'sunglasses'
  | 'mindblown'
  | 'hot'
  | 'ogre'
  // 動物
  | 'cat'
  | 'wolf'
  | 'fox'
  | 'frog'
  // ゲーム的
  | 'joystick'
  | 'target'
  | 'trophy'
  | 'dice'
  // エフェクト
  | 'boom'
  | 'rainbow'
  | 'crystalball'

/**
 * Ver.6 Phase 5.1: プロフィールアイコンの参照。今回はpresetのみ使用するが、将来
 * 自分の写真（サーバー画像ストレージ実装後）を追加しやすいよう、最初からkindで
 * 分岐する判別共用体にしてある。remoteCustomは今回どこからも生成しない
 * （型だけ先に用意し、実際のアップロード機能はサーバーProfile基盤＋R2実装時に追加する）。
 */
export type AvatarRef =
  | { kind: 'preset'; iconId: PresetIconId }
  | { kind: 'remoteCustom'; url: string }

/**
 * Ver.6 Phase 5: ログイン不要のローカルプロフィール。将来Public Profile（サーバー接続後）
 * にもそのまま使える最小限のフィールド構成にしてある。
 */
export interface PlayerProfile {
  playerId: PlayerId
  nickname: string
  /** Ver.6 Phase 5.1: 旧来の`iconId`フラットフィールドから移行。既存ユーザーの保存値は
   *  utils/profileStorage.tsのgetProfile()が透過的に{kind:'preset', iconId}へ変換する。 */
  avatar: AvatarRef
  /** 装備中Title（config/titles.tsのTitleDef.id）。未装備はnull。 */
  equippedTitleId: TitleId | null
  createdAt: number
}

/**
 * Ver.6 Phase 5.1（Achievement大幅拡充）: 実績の識別子。DOPA%系12個
 * （既存6個のidは維持：dopa100/120/200/300/400/500）＋Endless系12個
 * （初級/中級/上級×4段階）＝計24個。idはnameと分離してあり、将来名称だけを
 * 差し替えてもid・解除済みフラグには一切影響しない。
 */
export type AchievementId =
  | 'dopa50'
  | 'dopa100'
  | 'dopa120'
  | 'dopa150'
  | 'dopa200'
  | 'dopa250'
  | 'dopa300'
  | 'dopa350'
  | 'dopa400'
  | 'dopa450'
  | 'dopa490'
  | 'dopa500'
  | 'endlessBeginner10'
  | 'endlessBeginner25'
  | 'endlessBeginner50'
  | 'endlessBeginner100'
  | 'endlessIntermediate5'
  | 'endlessIntermediate15'
  | 'endlessIntermediate30'
  | 'endlessIntermediate50'
  | 'endlessAdvanced3'
  | 'endlessAdvanced10'
  | 'endlessAdvanced20'
  | 'endlessAdvanced30'

/**
 * 実績の解除条件。
 * - dopaPercent: 通常モード・FINAL DOPA TRIAL・500%チャレンジのいずれで到達しても共通の
 *   bestPercentV4（utils/storage.ts）がthreshold以上になった時点で解除。
 * - endlessStreak: 難易度別のEndless自己ベストがthreshold以上になった時点で解除。
 * - challenge500FinalQuestion: 490%（FINAL QUESTION、あと1問で500%）到達という一度きりの
 *   イベント。bestPercentの閾値では表現できない（490はMISSなら400へ、正解なら500へ
 *   瞬時に遷移し、記録される最終%として490そのものが残ることがないため）、専用の種別。
 */
export type AchievementUnlockCondition =
  | { type: 'dopaPercent'; threshold: number }
  | { type: 'endlessStreak'; difficulty: EndlessDifficulty; threshold: number }
  | { type: 'challenge500FinalQuestion' }

/** 実績のカテゴリ（Achievement画面のALL/DOPA/ENDLESSフィルタに使う）。 */
export type AchievementCategory = 'dopa' | 'endless'

/** 実績定義（config/achievements.ts）。id/name/description/unlockConditionを分離し、名称だけの差し替えを容易にする。 */
export interface AchievementDef {
  id: AchievementId
  name: string
  description: string
  unlockCondition: AchievementUnlockCondition
  category: AchievementCategory
  /** categoryが'endless'の場合のみ存在。Achievement画面のカード上に難易度バッジを出すために使う。 */
  endlessDifficulty?: EndlessDifficulty
}

/**
 * Ver.6 Phase 5: Title（称号）のid。現時点ではAchievementIdと1対1だが、将来Titleが
 * Achievement以外（Ranking順位・Challenge等）からも解放されうるため、型としては
 * AchievementIdへ固定せず別名として分離してある。
 */
export type TitleId = string

/** Title定義（config/titles.ts）。今回は仮称（例: "DOPA 300%"）でよい。 */
export interface TitleDef {
  id: TitleId
  name: string
  description: string
  unlockedByAchievementId: AchievementId
}

/**
 * Ver.6 Phase 5: 共通プレイヤー記録。既存storage（bestPercentV4・EndlessBestV1×3）を
 * 二重管理せず、utils/playerStatsRepository.tsが読み取り専用のビューとして組み立てる。
 * worldBattle*は将来のリアルタイム対戦実装後に初めて値を持つ（今回は常にundefined、
 * 偽の0としてUIへ表示しない）。
 */
export interface PlayerStats {
  maxDopaPercent: number
  endlessBeginnerBest: number
  endlessIntermediateBest: number
  endlessAdvancedBest: number
  achievementCount: number
  /** 将来用（世界対戦実装後）。今回は常にundefined。 */
  worldBattleWins?: number
  /** 将来用（世界対戦実装後）。今回は常にundefined。 */
  worldBattleMaxStreak?: number
}

/**
 * Ver.6 Phase 5: 将来のRanking6種類の識別子。Elo/rating/勝率ランキングは作らない
 * （ユーザー指示）。worldBattle系2種は対戦実装後に初めて値を持つカテゴリとして
 * 先に型だけ用意する。
 */
export type RankingCategoryId =
  | 'maxDopaPercent'
  | 'endlessBeginner'
  | 'endlessIntermediate'
  | 'endlessAdvanced'
  | 'worldBattleWins'
  | 'worldBattleMaxStreak'
