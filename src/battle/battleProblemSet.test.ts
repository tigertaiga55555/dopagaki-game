import { describe, expect, it } from 'vitest'
import { generateBattleProblemSet } from './battleProblemSet'

describe('generateBattleProblemSet (Ver.6 Phase 6: サーバー側ProblemSet確定)', () => {
  it('両プレイヤーに配布できる十分な長さの配列を返す', () => {
    const set = generateBattleProblemSet()
    expect(set.length).toBeGreaterThan(200)
  })

  it('各要素は既存のChallengeProblemSetItem形式（type文字列・data）を満たす', () => {
    const set = generateBattleProblemSet()
    for (const item of set) {
      expect(typeof item.type).toBe('string')
      expect(typeof item.data).toBe('object')
    }
  })

  it('DOPA BONUS TIMEの問題がちょうど1つ含まれる（通常プレイと同じく1ゲームにつき1回）', () => {
    const set = generateBattleProblemSet()
    const bonusCount = set.filter((item) => item.type === 'bonusTime').length
    expect(bonusCount).toBe(1)
  })

  it('呼ぶたびに異なる問題列が生成される（両プレイヤーで別々に生成するのではなく、1回の呼び出し結果を両者に配布する前提）', () => {
    const a = generateBattleProblemSet()
    const b = generateBattleProblemSet()
    expect(a).not.toEqual(b)
  })
})
