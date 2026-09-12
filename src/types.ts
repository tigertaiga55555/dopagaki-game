export type ScreenName = 'title' | 'playing' | 'result'

export type StepEffect =
  | 'crash'
  | 'spike'
  | 'fakeAnnounce'
  | 'fakeReveal'
  | 'suspense'
  | 'bonus'
  | 'recover'

export interface GameStep {
  point: number
  duration: number
  message?: string
  effect?: StepEffect
  isFirstCrash?: boolean
}

export interface RankDef {
  id: string
  min: number
  max: number
  name: string
  tier: 'low' | 'mid' | 'high'
}

export interface GameResult {
  finalPoint: number
  maxPoint: number
  rank: RankDef
  dopagakiPercent: number
  isAuto: boolean
  isNewBest: boolean
  bestPoint: number
  comment: string
  greedComment: string
}
