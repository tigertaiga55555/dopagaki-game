import { describe, expect, it } from 'vitest'
import { InterferenceSwipeChallenge500Module } from './InterferenceSwipeQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

const OPPOSITE: Record<string, string> = { 左: '右', 右: '左', 上: '下', 下: '上' }

type Data = { arrowWord: string; effectiveWord: string; segments: PromptSegment[] }

describe('InterferenceSwipeQuestion (FINAL-derived: ignore the decoy arrow, swipe the word)', () => {
  it('when the word is inverted, shown and effective direction are opposite; otherwise they match', () => {
    const seenInverted = new Set<boolean>()
    for (let i = 0; i < 600; i++) {
      const data = InterferenceSwipeChallenge500Module.generate(1) as Data
      const shown = data.segments[0]
      seenInverted.add(shown.inverted)
      if (shown.inverted) {
        expect(OPPOSITE[shown.text]).toBe(data.effectiveWord)
      } else {
        expect(shown.text).toBe(data.effectiveWord)
      }
    }
    expect(seenInverted.has(true)).toBe(true)
    expect(seenInverted.has(false)).toBe(true)
  })

  it('the decoy arrow is generated independently and is never required to match the correct answer', () => {
    let sawMismatch = false
    for (let i = 0; i < 600; i++) {
      const data = InterferenceSwipeChallenge500Module.generate(1) as Data
      if (data.arrowWord !== data.effectiveWord) sawMismatch = true
    }
    // 矢印が常に正解と一致してしまっていたら「無視すべきダミー」として機能していないため、
    // 不一致のケースが実際に発生することを確認する（妨害要素としての実効性の担保）。
    expect(sawMismatch).toBe(true)
  })

  it('every generated spec has a well-formed effectiveWord among the 4 directions', () => {
    for (let i = 0; i < 100; i++) {
      const data = InterferenceSwipeChallenge500Module.generate(1) as Data
      expect(['左', '右', '上', '下']).toContain(data.effectiveWord)
      expect(['左', '右', '上', '下']).toContain(data.arrowWord)
    }
  })
})
