import { describe, expect, it } from 'vitest'
import { problemSetItemToSpec, specToProblemSetItem } from './useChallenge500'
import type { Challenge500QuestionSpec } from '../questions/challenge500/types'

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: useChallenge500自体はReact hookのため直接
 * レンダーテストはしない（既存方針どおり）。Challengeのproblem set往復変換が
 * type/dataを保ったまま一致することだけを純粋関数として検証する
 * （Challenge500QuestionSpecにはtargetTimeMs/tagsが存在しないため、それらは対象外）。
 */
describe('useChallenge500: spec <-> ChallengeProblemSetItem round trip', () => {
  it('specToProblemSetItem: type/dataを保持する（targetTimeMsは持たない）', () => {
    const spec: Challenge500QuestionSpec = { instanceId: 'c-1', type: 'numberPick', data: { answer: 3 } }
    const item = specToProblemSetItem(spec)
    expect(item).toEqual({ type: 'numberPick', data: { answer: 3 } })
  })

  it('problemSetItemToSpec: 新しいinstanceIdでspecを復元する', () => {
    const spec = problemSetItemToSpec({ type: 'positionPick', data: { answer: 1 } })
    expect(spec.type).toBe('positionPick')
    expect(spec.data).toEqual({ answer: 1 })
    expect(typeof spec.instanceId).toBe('string')
  })

  it('問題順一致: 複数問を変換しても順番が保たれる', () => {
    const originalSpecs: Challenge500QuestionSpec[] = [
      { instanceId: '1', type: 'numberPick', data: { a: 1 } },
      { instanceId: '2', type: 'rpsCompound', data: { b: 2 } },
      { instanceId: '3', type: 'sequenceRank', data: { c: 3 } },
    ]
    const restored = originalSpecs.map(specToProblemSetItem).map(problemSetItemToSpec)
    expect(restored.map((s) => s.type)).toEqual(['numberPick', 'rpsCompound', 'sequenceRank'])
    expect(restored.map((s) => s.data)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })
})
