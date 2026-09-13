export type ScreenName = 'title' | 'playing' | 'result'

/** ドパガキ診断の内部カテゴリー */
export type DiagnosticCategory =
  | 'skip'
  | 'speed'
  | 'impulse'
  | 'stimulation'
  | 'notification'
  | 'patience'
  | 'result'

export type EventId =
  | 'videoMemory'
  | 'skipQuiz'
  | 'comboBoost'
  | 'instantReward'
  | 'notificationReflex'
  | 'sortRush'
  | 'holdRelease'
  | 'adCountdown'
  | 'treasureBox'
  | 'peekResult'
  | 'gambleChoice'

/** 1イベント終了時の診断（ドパガキ判定用）データ。診断対象にならないイベント/結果はundefined。 */
export interface DiagnosticOutcome {
  category: DiagnosticCategory
  /** 0〜100のドパガキ傾向スコア */
  score: number
  /** 集計時の重み（既定1。K（安全策vs一発逆転）のように影響を弱めたい場合に使う） */
  weight?: number
  /** スコアが高いときだけ入る「犯行記録」用の一文 */
  crimeText?: string
}

/** 1イベント終了時にPlayScreenへ返す結果。GAME SCOREへの加算とドパガキ診断は完全に分離する。 */
export interface EventResult {
  eventId: EventId
  /** GAME SCOREへの加算量（負の値も許容：高速仕分けのミスなど） */
  scoreDelta: number
  diagnostic?: DiagnosticOutcome
}

/** 残り時間などプレイ中の共有情報。一部イベント（Jなど）が参照する。 */
export interface PlayContext {
  getRemainingSeconds: () => number
  /** ここまでの診断結果から算出した、現時点のドパガキ度の粗い推定値（0〜100） */
  getCurrentDopagakiEstimate: () => number
}

export interface EventComponentProps {
  ctx: PlayContext
  onComplete: (result: EventResult) => void
}

export interface DopagakiTypeDef {
  id: string
  name: string
}

export interface FinalResult {
  gameScore: number
  dopagakiPercent: number
  type: DopagakiTypeDef
  comment: string
  crimeRecords: string[]
  isFirstPlay: boolean
  isNewLowDopagaki: boolean
  isNewHighScore: boolean
  firstDopagaki: number
  lowestDopagaki: number
  bestGameScore: number
  playCount: number
}
