import { describe, expect, it } from 'vitest'
import { composeCardFlourish, getSecretTheme, getTitleRarityTheme } from './titleRarityTheme'
import type { TitleRarity } from '../types'

const RARITIES: TitleRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

describe('composeCardFlourish (item 159: PASS専用カード外枠の刷新、排他→併存)', () => {
  /**
   * 実機検証で発覚した不具合の修正: composeCardFlourish()はもはやTailwindの
   * shadow-[...]クラス名文字列を返さない（実行時に動的合成される文字列は、
   * Tailwindのクラス名静的スキャンでは検出できずCSSが一切生成されなかった——
   * getComputedStyle().boxShadowが実機で"none"になることで発覚）。戻り値は
   * style={{boxShadow: ...}}へそのまま渡す生のCSS box-shadow値（スペース区切り、
   * Tailwindのアンダースコアエスケープ不要）であることをテストでも明示する。
   */
  it('戻り値は shadow-[ で始まらない（Tailwindクラス名ではなく生のCSS box-shadow値）', () => {
    const result = composeCardFlourish(getTitleRarityTheme('mythic').profileRingBoxShadow, true)
    expect(result.startsWith('shadow-[')).toBe(false)
    expect(result.endsWith(']')).toBe(false)
  })

  it('Title装飾なし・PASS非所有・baseBoxShadow未指定なら空文字（何も付与しない）', () => {
    expect(composeCardFlourish('', false)).toBe('')
  })

  it('Title装飾なし・PASS所有なら金レイヤーだけの生box-shadow値を返す', () => {
    const result = composeCardFlourish('', true)
    expect(result).toContain('251,191,36') // amber系の色
    expect(result).not.toContain('_') // Tailwindのアンダースコアエスケープを含まない
  })

  it('Title装飾あり・PASS非所有ならTitle側のbox-shadow値だけがそのまま使われる（併存ロジックに入らない）', () => {
    const titleRing = getTitleRarityTheme('legendary').profileRingBoxShadow
    const result = composeCardFlourish(titleRing, false)
    expect(result).toBe(titleRing)
  })

  it('Title装飾あり（LEGENDARY/MYTHIC/SECRET）・PASS所有の場合、Title側のレイヤーとPASSの金レイヤーの両方が1つのbox-shadow値に含まれる（排他ではなく併存）', () => {
    for (const rarity of ['legendary', 'mythic'] as TitleRarity[]) {
      const titleRing = getTitleRarityTheme(rarity).profileRingBoxShadow
      const result = composeCardFlourish(titleRing, true)
      // Title本来のレイヤーが消えていないこと（排他だった旧実装の回帰防止）
      expect(result).toContain(titleRing)
      // PASSの金レイヤーも追加されていること
      expect(result).toContain('251,191,36')
    }
    const secretRing = getSecretTheme().profileRingBoxShadow
    const secretResult = composeCardFlourish(secretRing, true)
    expect(secretResult).toContain(secretRing)
    expect(secretResult).toContain('251,191,36')
  })

  it('baseBoxShadow（カード常時の環境光）を指定すると、合成結果の先頭に含まれる（インラインstyle化でクラス由来の環境光が消えるのを防ぐ）', () => {
    const base = '0 0 30px rgba(217,70,239,0.08)'
    const titleRing = getTitleRarityTheme('mythic').profileRingBoxShadow
    const result = composeCardFlourish(titleRing, true, base)
    expect(result.startsWith(base)).toBe(true)
    expect(result).toContain(titleRing)
    expect(result).toContain('251,191,36')
  })

  it('Title装飾なし・PASS非所有でもbaseBoxShadowだけは返る', () => {
    const base = '0 0 30px rgba(217,70,239,0.08)'
    expect(composeCardFlourish('', false, base)).toBe(base)
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
