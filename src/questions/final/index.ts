import { FinalMathThresholdModule } from './FinalMathThresholdQuestion'
import { FinalMemoryPickModule } from './FinalMemoryPickQuestion'
import { FinalSecondLargestModule } from './FinalSecondLargestQuestion'
import { FinalSmallestEvenModule } from './FinalSmallestEvenQuestion'
import type { FinalPoolTier, FinalQuestionModule } from '../../types'

/**
 * Ver.5.0: FINAL DOPA TRIALの問題プール（階層ごと）。
 * Q1〜Q4=reversal、Q5〜Q8=twoCondition、Q9〜Q12=memory、Q13〜Q15=mixed。
 * Q16（FINAL QUESTION）はこのプールには含まれない専用固定問題（箱シャッフル）。
 */
export const FINAL_QUESTION_POOLS: Record<FinalPoolTier, FinalQuestionModule[]> = {
  reversal: [FinalSecondLargestModule],
  twoCondition: [FinalSmallestEvenModule],
  memory: [FinalMemoryPickModule],
  mixed: [FinalMathThresholdModule],
}

export const FINAL_QUESTION_MODULES: Record<string, FinalQuestionModule> = {
  [FinalSecondLargestModule.id]: FinalSecondLargestModule,
  [FinalSmallestEvenModule.id]: FinalSmallestEvenModule,
  [FinalMemoryPickModule.id]: FinalMemoryPickModule,
  [FinalMathThresholdModule.id]: FinalMathThresholdModule,
}
