import { FakeResultEvent } from './FakeResultEvent'
import { FinalTrapEvent } from './FinalTrapEvent'
import { InstantRewardEvent } from './InstantRewardEvent'
import { LoadingEvent } from './LoadingEvent'
import { NotificationEvent } from './NotificationEvent'
import { RapidTapEvent } from './RapidTapEvent'
import { ShortContentEvent } from './ShortContentEvent'
import { SkipEvent } from './SkipEvent'
import { SpeedToggleEvent } from './SpeedToggleEvent'
import { StimulusFreeEvent } from './StimulusFreeEvent'
import { TapSpeedEvent } from './TapSpeedEvent'
import { UnresponsiveEvent } from './UnresponsiveEvent'
import type { EventComponentProps, EventId } from '../types'
import type { ComponentType } from 'react'

export const EVENT_COMPONENTS: Record<EventId, ComponentType<EventComponentProps>> = {
  skip: SkipEvent,
  loading: LoadingEvent,
  rapidTap: RapidTapEvent,
  notification: NotificationEvent,
  stimulusFree: StimulusFreeEvent,
  shortContent: ShortContentEvent,
  tapSpeed: TapSpeedEvent,
  unresponsive: UnresponsiveEvent,
  instantReward: InstantRewardEvent,
  speedToggle: SpeedToggleEvent,
  fakeResult: FakeResultEvent,
  finalTrap: FinalTrapEvent,
}
