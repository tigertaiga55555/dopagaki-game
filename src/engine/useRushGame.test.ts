import { describe, expect, it } from 'vitest'
import { problemSetItemToSpec, specToProblemSetItem } from './useRushGame'
import type { QuestionSpec } from '../types'

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: useRushGame自体はReact hookのため直接
 * レンダーテストはしない（既存方針どおり）。ここでは、Challengeのproblem set
 * 往復変換（実際に出題されたQuestionSpec→保存用ChallengeProblemSetItem→
 * 再生時に復元したQuestionSpec）がtype/targetTimeMs/dataを保ったまま一致することだけを
 * 純粋関数として検証する（「問題条件一致」の最小保証）。
 */
describe('useRushGame: spec <-> ChallengeProblemSetItem round trip', () => {
  it('specToProblemSetItem: type/targetTimeMs/dataを保持する', () => {
    const spec: QuestionSpec = { instanceId: 'q-1', type: 'color', targetTimeMs: 850, data: { answer: 'red' } }
    const item = specToProblemSetItem(spec)
    expect(item).toEqual({ type: 'color', targetTimeMs: 850, data: { answer: 'red' } })
  })

  it('problemSetItemToSpec: 保存済みitemから新しいinstanceIdでspecを復元する', () => {
    const item = { type: 'oddOneOut', targetTimeMs: 1200, data: { answer: 2 } }
    const spec = problemSetItemToSpec(item)
    expect(spec.type).toBe('oddOneOut')
    expect(spec.targetTimeMs).toBe(1200)
    expect(spec.data).toEqual({ answer: 2 })
    expect(typeof spec.instanceId).toBe('string')
    expect(spec.instanceId.length).toBeGreaterThan(0)
  })

  it('問題順・問題条件一致: 複数問を変換しても順番とtargetTimeMsがそのまま保たれる', () => {
    const originalSpecs: QuestionSpec[] = [
      { instanceId: 'a', type: 'color', targetTimeMs: 900, data: { answer: 'blue' } },
      { instanceId: 'b', type: 'maxNumber', targetTimeMs: 1100, data: { numbers: [1, 2, 3] } },
      { instanceId: 'c', type: 'bonusTime', targetTimeMs: 4000, data: {} },
    ]
    const items = originalSpecs.map(specToProblemSetItem)
    const restored = items.map(problemSetItemToSpec)
    expect(restored.map((s) => s.type)).toEqual(['color', 'maxNumber', 'bonusTime'])
    expect(restored.map((s) => s.targetTimeMs)).toEqual([900, 1100, 4000])
    expect(restored.map((s) => s.data)).toEqual([{ answer: 'blue' }, { numbers: [1, 2, 3] }, {}])
  })

  it('targetTimeMsが未指定のitemはフォールバック値で復元される（データ欠損時も例外を投げない）', () => {
    const spec = problemSetItemToSpec({ type: 'color', data: {} })
    expect(typeof spec.targetTimeMs).toBe('number')
    expect(spec.targetTimeMs).toBeGreaterThan(0)
  })
})
