import { describe, expect, it } from 'vitest'
import { INVERSION_PAIRS, type InversionAxis, opposite, pickAxisWord } from './words'

const AXES = Object.keys(INVERSION_PAIRS) as InversionAxis[]

describe('inversion/words', () => {
  it('every axis opposite() round-trips correctly in both directions', () => {
    for (const axis of AXES) {
      const [a, b] = INVERSION_PAIRS[axis]
      expect(opposite(axis, a)).toBe(b)
      expect(opposite(axis, b)).toBe(a)
      // 反対の反対は元に戻る（自然な反対語ペアであることの基本保証）
      expect(opposite(axis, opposite(axis, a))).toBe(a)
    }
  })

  it('specific required pairs from the spec are present and correct', () => {
    expect(opposite('leftRight', '左')).toBe('右')
    expect(opposite('leftRight', '右')).toBe('左')
    expect(opposite('upDown', '上')).toBe('下')
    expect(opposite('upDown', '下')).toBe('上')
    expect(opposite('bigSmall', '大きい')).toBe('小さい')
    expect(opposite('bigSmall', '小さい')).toBe('大きい')
    expect(opposite('manyFew', '多い')).toBe('少ない')
    expect(opposite('manyFew', '少ない')).toBe('多い')
  })

  it('throws for a word that does not belong to the given axis (catches generator bugs early)', () => {
    expect(() => opposite('leftRight', '大きい')).toThrow()
  })

  it('pickAxisWord always returns one of the two valid words for the axis', () => {
    for (const axis of AXES) {
      for (let i = 0; i < 20; i++) {
        const word = pickAxisWord(axis)
        expect(INVERSION_PAIRS[axis]).toContain(word)
      }
    }
  })
})
