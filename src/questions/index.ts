import { BiggerShapeQuestionModule } from './BiggerShapeQuestion'
import { ColorQuestionModule } from './ColorQuestion'
import { DifferentOneQuestionModule } from './DifferentOneQuestion'
import { HoldPressQuestionModule } from './HoldPressQuestion'
import { MathQuestionModule } from './MathQuestion'
import { MoreSideQuestionModule } from './MoreSideQuestion'
import { MaxNumberQuestionModule, MinNumberQuestionModule } from './NumberExtremeQuestion'
import { NoPressQuestionModule } from './NoPressQuestion'
import { OddOneOutQuestionModule } from './OddOneOutQuestion'
import { RepeatTapQuestionModule } from './RepeatTapQuestion'
import { SameOneQuestionModule } from './SameOneQuestion'
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
}
