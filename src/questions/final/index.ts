import { FinalAscendingEvensModule } from './FinalAscendingEvensQuestion'
import { FinalExcludeColorModule } from './FinalExcludeColorQuestion'
import { FinalExcludeColorSortedModule } from './FinalExcludeColorSortedQuestion'
import { FinalMathThresholdModule } from './FinalMathThresholdQuestion'
import { FinalMemoryPickModule } from './FinalMemoryPickQuestion'
import { FinalReverseSequenceModule } from './FinalReverseSequenceQuestion'
import { FinalSecondLargestModule } from './FinalSecondLargestQuestion'
import { FinalSmallestEvenModule } from './FinalSmallestEvenQuestion'
import type { FinalPoolTier, FinalQuestionModule } from '../../types'

/**
 * Ver.5.0: FINAL DOPA TRIALの問題プール（階層ごと）。
 * Q1〜Q4=reversal、Q5〜Q8=twoCondition、Q9〜Q12=memory、Q13〜Q15=mixed。
 * Q16（FINAL QUESTION）はこのプールには含まれない専用固定問題（箱シャッフル）。
 * 各階層2種類ずつ用意し、anti-clustering（直前と同一typeを避ける／可能ならtagも被らせない）が
 * 実際に機能するだけの最低限のバリエーションを持たせている。
 */
export const FINAL_QUESTION_POOLS: Record<FinalPoolTier, FinalQuestionModule[]> = {
  reversal: [FinalSecondLargestModule, FinalExcludeColorModule],
  twoCondition: [FinalSmallestEvenModule, FinalAscendingEvensModule],
  memory: [FinalMemoryPickModule, FinalReverseSequenceModule],
  mixed: [FinalMathThresholdModule, FinalExcludeColorSortedModule],
}

export const FINAL_QUESTION_MODULES: Record<string, FinalQuestionModule> = {
  [FinalSecondLargestModule.id]: FinalSecondLargestModule,
  [FinalExcludeColorModule.id]: FinalExcludeColorModule,
  [FinalSmallestEvenModule.id]: FinalSmallestEvenModule,
  [FinalAscendingEvensModule.id]: FinalAscendingEvensModule,
  [FinalMemoryPickModule.id]: FinalMemoryPickModule,
  [FinalReverseSequenceModule.id]: FinalReverseSequenceModule,
  [FinalMathThresholdModule.id]: FinalMathThresholdModule,
  [FinalExcludeColorSortedModule.id]: FinalExcludeColorSortedModule,
}
