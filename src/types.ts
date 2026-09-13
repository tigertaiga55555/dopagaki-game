export type ScreenName = 'title' | 'measuring' | 'result'

export type EventCategory = 'skip' | 'impatience' | 'stimulation' | 'notification' | 'impulse' | 'result'

/** 各イベントが実装すべき共通ID一覧 */
export type EventId =
  | 'skip'
  | 'loading'
  | 'rapidTap'
  | 'notification'
  | 'stimulusFree'
  | 'shortContent'
  | 'tapSpeed'
  | 'unresponsive'
  | 'instantReward'
  | 'speedToggle'
  | 'fakeResult'
  | 'finalTrap'

/** 1イベント終了時に返す測定結果 */
export interface EventOutcome {
  eventId: EventId
  category: EventCategory
  /** 0〜100のドパガキスコア（高いほどドパガキ） */
  score: number
  /** スコアが高いときだけ入る「犯行記録」用の一文 */
  crimeText?: string
}

/** イベントコンポーネント共通props */
export interface EventComponentProps {
  onComplete: (outcome: EventOutcome) => void
}

export interface DopagakiTypeDef {
  id: string
  name: string
}

export interface DopagakiResult {
  percent: number
  type: DopagakiTypeDef
  comment: string
  crimeRecords: string[]
  categoryAverages: Partial<Record<EventCategory, number>>
  isFirstPlay: boolean
  isNewLow: boolean
  bestLowPercent: number
  playCount: number
}
