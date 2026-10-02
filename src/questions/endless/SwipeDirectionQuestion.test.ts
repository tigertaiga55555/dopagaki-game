import { describe, expect, it } from 'vitest'
import { SwipeDirectionEndlessModule } from './SwipeDirectionQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

describe('SwipeDirectionQuestion (inversion template, tier1 only)', () => {
  it('shown direction and effective (correct) direction are always opposite', () => {
    const OPPOSITE: Record<string, string> = { 左: '右', 右: '左', 上: '下', 下: '上' }
    for (let i = 0; i < 300; i++) {
      const data = SwipeDirectionEndlessModule.generate(1) as { effectiveWord: string; segments: PromptSegment[] }
      const shown = data.segments[0]
      expect(shown.inverted).toBe(true)
      expect(OPPOSITE[shown.text]).toBe(data.effectiveWord)
    }
  })
})
