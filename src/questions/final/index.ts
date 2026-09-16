import { FinalAscendingEvensModule } from './FinalAscendingEvensQuestion'
import { FinalAscendingOddsModule } from './FinalAscendingOddsQuestion'
import { FinalColorReverseSequenceModule } from './FinalColorReverseSequenceQuestion'
import { FinalDescendingEvensModule } from './FinalDescendingEvensQuestion'
import { FinalDescendingOddsModule } from './FinalDescendingOddsQuestion'
import { FinalExcludeColorModule } from './FinalExcludeColorQuestion'
import { FinalExcludeColorSortedModule } from './FinalExcludeColorSortedQuestion'
import { FinalExcludeOddOneOutModule } from './FinalExcludeOddOneOutQuestion'
import { FinalExcludeWinningHandModule } from './FinalExcludeWinningHandQuestion'
import { FinalFlashEvenReverseModule } from './FinalFlashEvenReverseQuestion'
import { FinalFlashOddDescendingModule } from './FinalFlashOddDescendingQuestion'
import { FinalIgnoreArrowSwipeModule } from './FinalIgnoreArrowSwipeQuestion'
import { FinalIgnoreTextSwipeModule } from './FinalIgnoreTextSwipeQuestion'
import { FinalLargestNonRedCircleModule } from './FinalLargestNonRedCircleQuestion'
import { FinalLargestOddModule } from './FinalLargestOddQuestion'
import { FinalMathReverseSwipeModule } from './FinalMathReverseSwipeQuestion'
import { FinalMathRepeatTapModule } from './FinalMathRepeatTapQuestion'
import { FinalMathThresholdModule } from './FinalMathThresholdQuestion'
import { FinalMemoryArrowReverseSwipeModule } from './FinalMemoryArrowReverseSwipeQuestion'
import { FinalMemoryEvenPickModule } from './FinalMemoryEvenPickQuestion'
import { FinalMemoryPickModule } from './FinalMemoryPickQuestion'
import { FinalNeverLitSpotModule } from './FinalNeverLitSpotQuestion'
import { FinalNonMaxEvenAscendingModule } from './FinalNonMaxEvenAscendingQuestion'
import { FinalNotBiggerCircleModule } from './FinalNotBiggerCircleQuestion'
import { FinalOppositeFlashModule } from './FinalOppositeFlashQuestion'
import { FinalQuestionBoxModule } from './FinalQuestionBox'
import { FinalRedFoodSwipeModule } from './FinalRedFoodSwipeQuestion'
import { FinalRedFoodSwipeTripleModule } from './FinalRedFoodSwipeTripleQuestion'
import { FinalReverseSequenceModule } from './FinalReverseSequenceQuestion'
import { FinalRpsForwardSequenceModule } from './FinalRpsForwardSequenceQuestion'
import { FinalRpsReverseSequenceModule } from './FinalRpsReverseSequenceQuestion'
import { FinalSecondLargestModule } from './FinalSecondLargestQuestion'
import { FinalSecondLargestEvenModule } from './FinalSecondLargestEvenQuestion'
import { FinalSecondLargestOddModule } from './FinalSecondLargestOddQuestion'
import { FinalSecondSmallestModule } from './FinalSecondSmallestQuestion'
import { FinalSmallestBlueCircleModule } from './FinalSmallestBlueCircleQuestion'
import { FinalSmallestEvenModule } from './FinalSmallestEvenQuestion'
import { FinalSplitRpsModule } from './FinalSplitRpsQuestion'
import { FinalTop3DescendingModule } from './FinalTop3DescendingQuestion'
import type { FinalPoolTier, FinalQuestionModule } from '../../types'

/**
 * Ver.5.0: FINAL DOPA TRIALの問題プール（階層ごと）。
 * Q1〜Q4=reversal、Q5〜Q8=twoCondition、Q9〜Q12=memory、Q13〜Q15=mixed。
 * Q16（FINAL QUESTION）はこのプールには含まれない専用固定問題（箱シャッフル）。
 *
 * 追加実装（母数拡張）：FINAL DOPA TRIALは15問連続でプレイするため、当初の各階層2種類
 * （計8種類）ではanti-clusteringだけでは反復感を解消しきれないという指摘を受け、
 * 各階層を仕様で採用済みだった問題候補を可能な限り実装して拡張した
 * （reversal 7種／twoCondition 12種／memory 7種／mixed 12種、計38種＋Q16ボス）。
 */
export const FINAL_QUESTION_POOLS: Record<FinalPoolTier, FinalQuestionModule[]> = {
  reversal: [
    FinalSecondLargestModule,
    FinalExcludeColorModule,
    FinalSecondSmallestModule,
    FinalExcludeOddOneOutModule,
    FinalNotBiggerCircleModule,
    FinalOppositeFlashModule,
    FinalExcludeWinningHandModule,
  ],
  twoCondition: [
    FinalSmallestEvenModule,
    FinalAscendingEvensModule,
    FinalLargestOddModule,
    FinalSecondLargestEvenModule,
    FinalSecondLargestOddModule,
    FinalLargestNonRedCircleModule,
    FinalSmallestBlueCircleModule,
    FinalAscendingOddsModule,
    FinalDescendingOddsModule,
    FinalDescendingEvensModule,
    FinalRedFoodSwipeModule,
    FinalSplitRpsModule,
  ],
  memory: [
    FinalMemoryPickModule,
    FinalReverseSequenceModule,
    FinalNeverLitSpotModule,
    FinalColorReverseSequenceModule,
    FinalMemoryEvenPickModule,
    FinalMemoryArrowReverseSwipeModule,
    FinalRpsForwardSequenceModule,
  ],
  mixed: [
    FinalMathThresholdModule,
    FinalExcludeColorSortedModule,
    FinalFlashEvenReverseModule,
    FinalFlashOddDescendingModule,
    FinalMathReverseSwipeModule,
    FinalIgnoreTextSwipeModule,
    FinalIgnoreArrowSwipeModule,
    FinalRedFoodSwipeTripleModule,
    FinalNonMaxEvenAscendingModule,
    FinalMathRepeatTapModule,
    FinalTop3DescendingModule,
    FinalRpsReverseSequenceModule,
  ],
}

/**
 * Q16（FinalQuestionBoxModule）はFINAL_QUESTION_POOLSには絶対に含めない
 * （ランダム抽選プールに混ざるとQ1〜15でも出題されうる事故になるため）。
 * FinalTrialScreenのComponentルックアップのためだけにFINAL_QUESTION_MODULESへ登録する。
 */
const ALL_POOL_MODULES = [
  ...FINAL_QUESTION_POOLS.reversal,
  ...FINAL_QUESTION_POOLS.twoCondition,
  ...FINAL_QUESTION_POOLS.memory,
  ...FINAL_QUESTION_POOLS.mixed,
]

export const FINAL_QUESTION_MODULES: Record<string, FinalQuestionModule> = {
  ...Object.fromEntries(ALL_POOL_MODULES.map((m) => [m.id, m])),
  [FinalQuestionBoxModule.id]: FinalQuestionBoxModule,
}
