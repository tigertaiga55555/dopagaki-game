import { describe, expect, it } from 'vitest'
import { sfx } from './sound'

/**
 * 次フェーズ（item 149-153、UI効果音拡充ラウンド）: sound.endless.test.tsと同じ流儀。
 * Node（vitest）環境にはAudioContextが存在しないため、utils/audioContext.tsの
 * getAudioContext()はtypeof window === 'undefined'で早期にnullを返し、beep/sweep/
 * noiseBurst等は何もせず安全にno-opする。ここでは「例外を投げずに呼び出せること」
 * だけを確認する（実際の音響特性・ミュート連動・二重発火防止はPlaywright実機確認で検証する）。
 */
describe('sfx.uiTap / navBack / navHome / titleEquip (item 149-153: 通常メニューUI効果音)', () => {
  it('uiTap does not throw', () => {
    expect(() => sfx.uiTap()).not.toThrow()
  })

  it('navBack does not throw', () => {
    expect(() => sfx.navBack()).not.toThrow()
  })

  it('navHome does not throw', () => {
    expect(() => sfx.navHome()).not.toThrow()
  })

  it('titleEquip does not throw', () => {
    expect(() => sfx.titleEquip()).not.toThrow()
  })

  it('全て連続で呼び出しても例外を投げない（連打・画面遷移の連続発火を想定）', () => {
    expect(() => {
      for (let i = 0; i < 20; i++) {
        sfx.uiTap()
        sfx.navBack()
        sfx.navHome()
        sfx.titleEquip()
      }
    }).not.toThrow()
  })
})
