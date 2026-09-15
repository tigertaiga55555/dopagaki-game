import { BiggerShapeQuestionModule } from './BiggerShapeQuestion'
import { ClearNotificationsQuestionModule } from './ClearNotificationsQuestion'
import { ColorQuestionModule } from './ColorQuestion'
import { DifferentOneQuestionModule } from './DifferentOneQuestion'
import { FoodSortQuestionModule } from './FoodSortQuestion'
import { GoWaitQuestionModule } from './GoWaitQuestion'
import { HoldPressQuestionModule } from './HoldPressQuestion'
import { MathQuestionModule } from './MathQuestion'
import { MoreSideQuestionModule } from './MoreSideQuestion'
import { MaxNumberQuestionModule, MinNumberQuestionModule } from './NumberExtremeQuestion'
import { NoPressQuestionModule } from './NoPressQuestion'
import { OddOneOutQuestionModule } from './OddOneOutQuestion'
import { RapidStopQuestionModule } from './RapidStopQuestion'
import { RepeatTapQuestionModule } from './RepeatTapQuestion'
import { SameOneQuestionModule } from './SameOneQuestion'
import { SkipWaitQuestionModule } from './SkipWaitQuestion'
import { SpotChangeQuestionModule } from './SpotChangeQuestion'
import { StopAt100QuestionModule } from './StopAt100Question'
import { SwipeQuestionModule } from './SwipeQuestion'
import type { QuestionModule, QuestionTypeId } from '../types'

export const QUESTION_MODULES: Record<QuestionTypeId, QuestionModule> = {
  color: ColorQuestionModule,
  oddOneOut: OddOneOutQuestionModule,
  maxNumber: MaxNumberQuestionModule,
  minNumber: MinNumberQuestionModule,
  differentOne: DifferentOneQuestionModule,
  sameOne: SameOneQuestionModule,
  moreSide: MoreSideQuestionModule,
  biggerShape: BiggerShapeQuestionModule,
  simpleMath: MathQuestionModule,
  swipe: SwipeQuestionModule,
  repeatTap: RepeatTapQuestionModule,
  holdPress: HoldPressQuestionModule,
  noPress: NoPressQuestionModule,
  goWait: GoWaitQuestionModule,
  skipWait: SkipWaitQuestionModule,
  rapidStop: RapidStopQuestionModule,
  stopAt100: StopAt100QuestionModule,
  clearNotifications: ClearNotificationsQuestionModule,
  spotChange: SpotChangeQuestionModule,
  foodSort: FoodSortQuestionModule,
}
