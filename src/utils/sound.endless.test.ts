import { describe, expect, it } from 'vitest'
import { sfx } from './sound'

/**
 * Node（vitest）環境にはAudioContextが存在しないため、utils/audioContext.tsの
 * getAudioContext()はtypeof window === 'undefined'で早期にnullを返し、beep/sweep等は
 * 何もせず安全にno-opする（既存のsound.ts全関数が元々そうなっている）。
 * ここでは「難易度ごとに別のSE関数パスが例外なく呼び出せること」だけを確認する
 * （実際の音響特性はPlaywright実機確認で検証する）。
 */
describe('sfx.endlessCorrect / endlessMiss / endlessNewBest (Ver.6 Phase 4.1 sound theme)', () => {
  it('endlessCorrect does not throw for any difficulty/intensity combination', () => {
    const difficulties = ['beginner', 'intermediate', 'advanced'] as const
    const intensities = [1, 2, 3, 4, 5] as const
    for (const d of difficulties) {
      for (const i of intensities) {
        expect(() => sfx.endlessCorrect(d, i)).not.toThrow()
      }
    }
  })

  it('endlessMiss does not throw for any difficulty', () => {
    for (const d of ['beginner', 'intermediate', 'advanced'] as const) {
      expect(() => sfx.endlessMiss(d)).not.toThrow()
    }
  })

  it('endlessNewBest does not throw', () => {
    expect(() => sfx.endlessNewBest()).not.toThrow()
  })
})
