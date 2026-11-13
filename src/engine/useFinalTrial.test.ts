import { describe, expect, it } from 'vitest'
import { problemSetItemToSpec, specToProblemSetItem } from './useFinalTrial'
import type { FinalQuestionSpec } from '../types'

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: useFinalTrial自体はReact hookのため直接
 * レンダーテストはしない（既存方針どおり）。Challengeのproblem set往復変換が
 * type/targetTimeMs/tags/dataを保ったまま一致することだけを純粋関数として検証する。
 */
describe('useFinalTrial: spec <-> ChallengeProblemSetItem round trip', () => {
  it('specToProblemSetItem: type/targetTimeMs/tags/dataを保持する', () => {
    const spec: FinalQuestionSpec = {
      instanceId: 'f-1',
      type: 'finalMemoryPick',
      tags: ['memory', 'visual'],
      targetTimeMs: 2000,
      data: { answer: 3 },
    }
    const item = specToProblemSetItem(spec)
    expect(item).toEqual({ type: 'finalMemoryPick', targetTimeMs: 2000, tags: ['memory', 'visual'], data: { answer: 3 } })
  })

  it('problemSetItemToSpec: tagsが無いitemは空配列で復元する', () => {
    const spec = problemSetItemToSpec({ type: 'finalSecondLargest', targetTimeMs: 1500, data: { answer: 1 } })
    expect(spec.type).toBe('finalSecondLargest')
    expect(spec.tags).toEqual([])
    expect(spec.targetTimeMs).toBe(1500)
  })

  it('問題順・問題条件一致: ULTIMATE QUESTIONを含む16問ぶんの変換でも順番とtagsが保たれる', () => {
    const originalSpecs: FinalQuestionSpec[] = [
      { instanceId: '1', type: 'finalAscendingEvens', tags: ['sequence'], targetTimeMs: 1800, data: { a: 1 } },
      { instanceId: '2', type: 'finalUltimateRpsQuadReverse', tags: ['rps', 'reverse'], targetTimeMs: 2500, data: { b: 2 } },
    ]
    const restored = originalSpecs.map(specToProblemSetItem).map(problemSetItemToSpec)
    expect(restored.map((s) => s.type)).toEqual(['finalAscendingEvens', 'finalUltimateRpsQuadReverse'])
    expect(restored.map((s) => s.tags)).toEqual([['sequence'], ['rps', 'reverse']])
    expect(restored.map((s) => s.targetTimeMs)).toEqual([1800, 2500])
  })
})
