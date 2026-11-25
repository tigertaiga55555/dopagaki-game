import { describe, expect, it } from 'vitest'
import { composeCardFlourish, getSecretTheme, getTitleRarityTheme } from './titleRarityTheme'
import type { TitleRarity } from '../types'

const RARITIES: TitleRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

describe('composeCardFlourish (item 159: PASS専用カード外枠の刷新、排他→併存)', () => {
  it('Title装飾なし・PASS非所有なら空文字（何も付与しない）', () => {
    expect(composeCardFlourish('', false)).toBe('')
  })

  it('Title装飾なし・PASS所有なら金レイヤーだけのshadow-[...]を返す', () => {
    const result = composeCardFlourish('', true)
    expect(result.startsWith('shadow-[')).toBe(true)
    expect(result).toContain('251,191,36') // amber系の色
  })

  it('Title装飾あり・PASS非所有ならTitle側のbox-shadow値だけがそのまま使われる（併存ロジックに入らない）', () => {
    const titleRing = getTitleRarityTheme('legendary').profileRingBoxShadow
    const result = composeCardFlourish(titleRing, false)
    expect(result).toBe(`shadow-[${titleRing}]`)
  })

  it('Title装飾あり（LEGENDARY/MYTHIC/SECRET）・PASS所有の場合、Title側のレイヤーとPASSの金レイヤーの両方が1つのshadow-[...]に含まれる（排他ではなく併存）', () => {
    for (const rarity of ['legendary', 'mythic'] as TitleRarity[]) {
      const titleRing = getTitleRarityTheme(rarity).profileRingBoxShadow
      const result = composeCardFlourish(titleRing, true)
      // Title本来のレイヤーが消えていないこと（排他だった旧実装の回帰防止）
      expect(result).toContain(titleRing)
      // PASSの金レイヤーも追加されていること
      expect(result).toContain('251,191,36')
      expect(result.startsWith('shadow-[') && result.endsWith(']')).toBe(true)
    }
    const secretRing = getSecretTheme().profileRingBoxShadow
    const secretResult = composeCardFlourish(secretRing, true)
    expect(secretResult).toContain(secretRing)
    expect(secretResult).toContain('251,191,36')
  })

  it('COMMON/RARE/EPICはprofileRingBoxShadowが空文字（Profile全体を過剰に色付けしない既存方針）', () => {
    for (const rarity of ['common', 'rare', 'epic'] as TitleRarity[]) {
      expect(getTitleRarityTheme(rarity).profileRingBoxShadow).toBe('')
    }
  })

  it('全rarityのprofileRingClassとprofileRingBoxShadowは「空である/ない」が一致する（片方だけ値を持つ食い違いを防ぐ）', () => {
    for (const rarity of RARITIES) {
      const theme = getTitleRarityTheme(rarity)
      expect(theme.profileRingClass.length > 0).toBe(theme.profileRingBoxShadow.length > 0)
    }
  })

  it('MYTHICのprofileRingPulseClassはanim-rarity-rainbow-slow、SECRETはanim-rarity-secret-slow（既存のpulseクラス名をそのまま分離している）', () => {
    expect(getTitleRarityTheme('mythic').profileRingPulseClass).toBe('anim-rarity-rainbow-slow')
    expect(getSecretTheme().profileRingPulseClass).toBe('anim-rarity-secret-slow')
  })

  it('LEGENDARYはprofileRingClassにpulseクラスを元々持たないため、profileRingPulseClassは空文字', () => {
    expect(getTitleRarityTheme('legendary').profileRingPulseClass).toBe('')
  })
})
