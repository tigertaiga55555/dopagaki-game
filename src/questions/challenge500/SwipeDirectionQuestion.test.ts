import { describe, expect, it } from 'vitest'
import { SwipeDirectionChallenge500Module } from './SwipeDirectionQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

const OPPOSITE: Record<string, string> = { 左: '右', 右: '左', 上: '下', 下: '上' }

describe('SwipeDirectionQuestion (inversion template, tier1-only, 0/1-inversion mixing)', () => {
  it('when inverted, shown and effective direction are opposite; when not inverted, they match', () => {
    const seenInverted = new Set<boolean>()
    for (let i = 0; i < 600; i++) {
      const data = SwipeDirectionChallenge500Module.generate(1) as { effectiveWord: string; segments: PromptSegment[] }
      const shown = data.segments[0]
      seenInverted.add(shown.inverted)
      if (shown.inverted) {
        expect(OPPOSITE[shown.text]).toBe(data.effectiveWord)
      } else {
        expect(shown.text).toBe(data.effectiveWord)
      }
    }
    // 反転あり・なしの両方が出ること（毎問必ず反転は禁止、という訂正事項）。
    expect(seenInverted.has(true)).toBe(true)
    expect(seenInverted.has(false)).toBe(true)
  })
})
