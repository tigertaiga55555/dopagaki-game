import { AdCountdownEvent } from './AdCountdownEvent'
import { ComboBoostEvent } from './ComboBoostEvent'
import { GambleChoiceEvent } from './GambleChoiceEvent'
import { HoldReleaseEvent } from './HoldReleaseEvent'
import { InstantRewardEvent } from './InstantRewardEvent'
import { NotificationReflexEvent } from './NotificationReflexEvent'
import { PeekResultEvent } from './PeekResultEvent'
import { SkipQuizEvent } from './SkipQuizEvent'
import { SortRushEvent } from './SortRushEvent'
import { TreasureBoxEvent } from './TreasureBoxEvent'
import { VideoMemoryEvent } from './VideoMemoryEvent'
import type { EventComponentProps, EventId } from '../types'
import type { ComponentType } from 'react'

export const EVENT_COMPONENTS: Record<EventId, ComponentType<EventComponentProps>> = {
  videoMemory: VideoMemoryEvent,
  skipQuiz: SkipQuizEvent,
  comboBoost: ComboBoostEvent,
  instantReward: InstantRewardEvent,
  notificationReflex: NotificationReflexEvent,
  sortRush: SortRushEvent,
  holdRelease: HoldReleaseEvent,
  adCountdown: AdCountdownEvent,
  treasureBox: TreasureBoxEvent,
  peekResult: PeekResultEvent,
  gambleChoice: GambleChoiceEvent,
}
