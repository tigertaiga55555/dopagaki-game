import { describe, expect, it } from 'vitest'
import { ENDLESS_BATTLE_PROBLEM_COUNT, generateEndlessBattleProblemSet } from './endlessBattleProblemSet'
import type { EndlessDifficulty } from '../types'

const DIFFICULTIES: EndlessDifficulty[] = ['beginner', 'intermediate', 'advanced']

describe('endlessBattleProblemSet (PRIVATE ROOM ENDLESS、DOPA PASS基盤ラウンド item 15)', () => {
  it.each(DIFFICULTIES)('%sは既定でENDLESS_BATTLE_PROBLEM_COUNT件を生成する', (difficulty) => {
    const items = generateEndlessBattleProblemSet(difficulty)
    expect(items).toHaveLength(ENDLESS_BATTLE_PROBLEM_COUNT)
  })

  it('countを指定すればその件数だけ生成する', () => {
    const items = generateEndlessBattleProblemSet('beginner', 10)
    expect(items).toHaveLength(10)
  })

  it('各要素はChallengeProblemSetItemの最小形（type必須）を満たす', () => {
    const items = generateEndlessBattleProblemSet('advanced', 20)
    for (const item of items) {
      expect(typeof item.type).toBe('string')
    }
  })

  it('2回生成すると（ランダム要素があるため）常に同一にはならない', () => {
    const a = generateEndlessBattleProblemSet('intermediate', 30)
    const b = generateEndlessBattleProblemSet('intermediate', 30)
    expect(a).not.toEqual(b)
  })
})
