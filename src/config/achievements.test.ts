import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_DEFS } from './achievements'
import { TITLE_DEFS } from './titles'
import type { AchievementCategory } from '../types'

/**
 * Ver.6 Phase 10（実績拡張ラウンド）: Achievement/Title 68個化の構造的な保証。
 * 名称・条件そのものの正しさは achievementStorage.test.ts / 各機能のテストで検証する。
 * ここではあくまで「68個ちょうど」「カテゴリ別件数」「ID重複なし」「Achievement/Title
 * が1対1」だけを保証する。
 */
describe('ACHIEVEMENT_DEFS (Ver.6 Phase 10: 68個への拡張)', () => {
  it('合計68個である', () => {
    expect(ACHIEVEMENT_DEFS).toHaveLength(68)
  })

  it('カテゴリ別の件数が仕様どおり（Normal/LIMIT BREAK 12・ENDLESS 15・Challenge 12・World Battle 12・Friend Battle 4・Special 8・Grind 5）', () => {
    const counts = ACHIEVEMENT_DEFS.reduce<Record<AchievementCategory, number>>(
      (acc, def) => {
        acc[def.category] = (acc[def.category] ?? 0) + 1
        return acc
      },
      { dopa: 0, endless: 0, challenge: 0, worldBattle: 0, friendBattle: 0, special: 0, grind: 0 },
    )
    expect(counts).toEqual({
      dopa: 12,
      endless: 15,
      challenge: 12,
      worldBattle: 12,
      friendBattle: 4,
      special: 8,
      grind: 5,
    })
  })

  it('Achievement IDに重複がない', () => {
    const ids = ACHIEVEMENT_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('既存26個のID（Ver.6 Phase 5.1時点）が1つも欠落・変更されていない', () => {
    const existingIds = [
      'dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200', 'dopa250', 'dopa300', 'dopa350', 'dopa400', 'dopa450', 'dopa490', 'dopa500',
      'endlessBeginner10', 'endlessBeginner25', 'endlessBeginner50', 'endlessBeginner100',
      'endlessIntermediate5', 'endlessIntermediate15', 'endlessIntermediate30', 'endlessIntermediate50',
      'endlessAdvanced3', 'endlessAdvanced10', 'endlessAdvanced20', 'endlessAdvanced30',
      'endlessChallengeFirstWin', 'endlessChallengeFirstDefense',
    ]
    const ids = new Set(ACHIEVEMENT_DEFS.map((d) => d.id))
    for (const id of existingIds) expect(ids.has(id as never)).toBe(true)
  })

  it('secret指定は鏡写し・大逆転の2個のみ（全てをSecretにはしない）', () => {
    const secretIds = ACHIEVEMENT_DEFS.filter((d) => d.secret).map((d) => d.id)
    expect(secretIds.sort()).toEqual(['battleComeback', 'battleMirrorMatch'].sort())
  })

  it('rarity=rareは500%・100勝・250勝・20連勝・1000プレイ・Secret系2個の計7個', () => {
    const rareIds = ACHIEVEMENT_DEFS.filter((d) => d.rarity === 'rare').map((d) => d.id)
    expect(rareIds.sort()).toEqual(
      ['dopa500', 'worldBattleWin100', 'worldBattleWin250', 'worldBattleStreak20', 'grindPlay1000', 'battleMirrorMatch', 'battleComeback'].sort(),
    )
  })
})

describe('TITLE_DEFS (Ver.6 Phase 10: Achievementと1対1の68個)', () => {
  it('合計68個である', () => {
    expect(TITLE_DEFS).toHaveLength(68)
  })

  it('Title IDに重複がない', () => {
    const ids = TITLE_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ACHIEVEMENT_DEFSと完全に同じID集合を持つ（Achievement 1個 = Title 1個）', () => {
    const achievementIds = new Set(ACHIEVEMENT_DEFS.map((d) => d.id))
    const titleIds = new Set(TITLE_DEFS.map((d) => d.id))
    expect(titleIds).toEqual(achievementIds)
  })

  it('各TitleDef.unlockedByAchievementIdは自分自身のidと同じ文字列である（1対1規約）', () => {
    for (const title of TITLE_DEFS) {
      expect(title.unlockedByAchievementId).toBe(title.id)
    }
  })

  /**
   * 次フェーズ（Profile/Heart UI強化ラウンド、item 8）: 68個全てが5段階レアリティの
   * いずれか1つを持ち、一律の単一tierに潰れていないことを保証する。
   */
  it('全68個がCOMMON/RARE/EPIC/LEGENDARY/MYTHICのいずれかを持つ', () => {
    const validRarities = new Set(['common', 'rare', 'epic', 'legendary', 'mythic'])
    for (const title of TITLE_DEFS) {
      expect(validRarities.has(title.rarity)).toBe(true)
    }
  })

  it('rarityの内訳が設計どおり（COMMON19・RARE23・EPIC14・LEGENDARY7・MYTHIC5＝全68）', () => {
    const counts = TITLE_DEFS.reduce<Record<string, number>>((acc, t) => {
      acc[t.rarity] = (acc[t.rarity] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ common: 19, rare: 23, epic: 14, legendary: 7, mythic: 5 })
  })

  it('MYTHICは真・ドパガキ/250勝/1000プレイ/鏡写し/大逆転の5個のみ（全てが同じtierに潰れていない）', () => {
    const mythicIds = TITLE_DEFS.filter((t) => t.rarity === 'mythic')
      .map((t) => t.id)
      .sort()
    expect(mythicIds).toEqual(['battleComeback', 'battleMirrorMatch', 'dopa500', 'grindPlay1000', 'worldBattleWin250'].sort())
  })
})
