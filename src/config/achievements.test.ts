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
describe('ACHIEVEMENT_DEFS (Ver.6 Phase 10: 68個への拡張 → item 104-109でDOPA TYPE8個追加の76個 → item 129でGrindに300回を追加した77個)', () => {
  it('合計77個である', () => {
    expect(ACHIEVEMENT_DEFS).toHaveLength(77)
  })

  it('カテゴリ別の件数が仕様どおり（Normal/LIMIT BREAK 20・ENDLESS 15・Challenge 12・World Battle 12・Friend Battle 4・Special 8・Grind 6）', () => {
    const counts = ACHIEVEMENT_DEFS.reduce<Record<AchievementCategory, number>>(
      (acc, def) => {
        acc[def.category] = (acc[def.category] ?? 0) + 1
        return acc
      },
      { dopa: 0, endless: 0, challenge: 0, worldBattle: 0, friendBattle: 0, special: 0, grind: 0 },
    )
    expect(counts).toEqual({
      dopa: 20,
      endless: 15,
      challenge: 12,
      worldBattle: 12,
      friendBattle: 4,
      special: 8,
      grind: 6,
    })
  })

  it('item 104-109: DOPA TYPEの8帯が新規実績として存在し、dopaPercentBand（帯のみ・累積しない）で判定される', () => {
    const dopaTypeIds = [
      'dopaTypeReason',
      'dopaTypeImpatient',
      'dopaTypeReflex',
      'dopaTypeWild',
      'dopaTypeAwakened',
      'dopaTypeAce',
      'dopaTypeLegend',
      'dopaTypeKing',
    ]
    for (const id of dopaTypeIds) {
      const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
      expect(def).toBeDefined()
      expect(def?.unlockCondition.type).toBe('dopaPercentBand')
      expect(def?.category).toBe('dopa')
    }
  })

  it('item 104-105: dopa500（既存Title/Achievement）が「ドパガキの神」へ改名されている（新規重複作成はしていない）', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'dopa500')
    expect(def?.name).toBe('ドパガキの神')
    expect(def?.unlockCondition).toEqual({ type: 'dopaPercent', threshold: 500 })
    expect(def?.rarity).toBe('rare')
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

  /**
   * 次フェーズ（item 120-122、126: リリース前最終デザインラウンド）: 並び順の検証。
   * 最優先順位「①カテゴリ→②ゲーム内進行→③条件数値の昇順→④rarity」のうち、
   * ③（条件数値の昇順）をここで直接確認する。rarityだけで機械的に並べていないこと、
   * 「既存12個→追加8個」という実装順表示になっていないことも併せて保証する。
   */
  describe('item 120-122: 並び順の整理', () => {
    it('DOPA RUSH（dopaカテゴリ）: 解除条件のDOPA%で完全昇順（既存マイルストーンとDOPA TYPEが自然に混ざっている）', () => {
      const dopaIds = ACHIEVEMENT_DEFS.filter((d) => d.category === 'dopa').map((d) => d.id)
      expect(dopaIds).toEqual([
        'dopaTypeReason',
        'dopaTypeImpatient',
        'dopa50',
        'dopaTypeReflex',
        'dopaTypeWild',
        'dopa100',
        'dopaTypeAwakened',
        'dopa120',
        'dopa150',
        'dopa200',
        'dopaTypeAce',
        'dopa250',
        'dopa300',
        'dopaTypeLegend',
        'dopa350',
        'dopa400',
        'dopaTypeKing',
        'dopa450',
        'dopa490',
        'dopa500',
      ])
    })

    it('ENDLESS: 初級→中級→上級の順、各難易度内では必要STREAKの完全昇順', () => {
      const endlessDefs = ACHIEVEMENT_DEFS.filter((d) => d.category === 'endless')
      const difficulties = endlessDefs.map((d) => d.endlessDifficulty)
      const firstIntermediateIndex = difficulties.indexOf('intermediate')
      const firstAdvancedIndex = difficulties.indexOf('advanced')
      expect(difficulties.slice(0, firstIntermediateIndex).every((d) => d === 'beginner')).toBe(true)
      expect(difficulties.slice(firstIntermediateIndex, firstAdvancedIndex).every((d) => d === 'intermediate')).toBe(true)
      expect(difficulties.slice(firstAdvancedIndex).every((d) => d === 'advanced')).toBe(true)

      for (const difficulty of ['beginner', 'intermediate', 'advanced'] as const) {
        const thresholds = endlessDefs
          .filter((d) => d.endlessDifficulty === difficulty)
          .map((d) => (d.unlockCondition.type === 'endlessStreak' ? d.unlockCondition.threshold : -1))
        const sorted = [...thresholds].sort((a, b) => a - b)
        expect(thresholds).toEqual(sorted)
      }
    })

    it('Challenge: 初挑戦系→勝利系→防衛系→回数系→高難度/特殊の順。NORMALとENDLESS Challengeが混ざっていない', () => {
      const challengeIds = ACHIEVEMENT_DEFS.filter((d) => d.category === 'challenge').map((d) => d.id)
      expect(challengeIds).toEqual([
        'challengeCreatedFirst',
        'challengeParticipatedFirst',
        'challengeWin1',
        'challengeWin5',
        'challengeWin20',
        'challengeWin50',
        'challengeDefense1',
        'challengeDefense10',
        'challengeDefense25',
        'challengeWanted10',
        'endlessChallengeFirstWin',
        'endlessChallengeFirstDefense',
      ])
    })

    it('World Battle: 初勝利→累計勝利数（1/10/50/100/250の昇順）→連勝→特殊の順', () => {
      const worldBattleIds = ACHIEVEMENT_DEFS.filter((d) => d.category === 'worldBattle').map((d) => d.id)
      expect(worldBattleIds).toEqual([
        'worldBattleFirstPlay',
        'worldBattleWin1',
        'worldBattleWin10',
        'worldBattleWin25',
        'worldBattleWin50',
        'worldBattleWin100',
        'worldBattleWin250',
        'worldBattleStreak3',
        'worldBattleStreak5',
        'worldBattleStreak10',
        'worldBattleStreak20',
        'worldBattleFirstDraw',
      ])
    })

    it('Friend: 初回→回数・継続の昇順', () => {
      const friendIds = ACHIEVEMENT_DEFS.filter((d) => d.category === 'friendBattle').map((d) => d.id)
      expect(friendIds).toEqual(['friendBattleFirstPlay', 'friendBattlePlay10', 'friendBattlePlay50', 'friendBattlePlay100'])
    })

    it('Grind: 数値条件の完全昇順（10/50/100/300/500/1000、item 129で300を追加）', () => {
      const grindIds = ACHIEVEMENT_DEFS.filter((d) => d.category === 'grind').map((d) => d.id)
      expect(grindIds).toEqual(['grindPlay10', 'grindPlay50', 'grindPlay100', 'grindPlay300', 'grindPlay500', 'grindPlay1000'])
    })

    it('Special: SECRET（鏡写し・大逆転）が最後にまとまっている（SECRETの存在を隠す仕様と矛盾しない）', () => {
      const specialDefs = ACHIEVEMENT_DEFS.filter((d) => d.category === 'special')
      const secretIndices = specialDefs.map((d, i) => (d.secret ? i : -1)).filter((i) => i >= 0)
      const lastNonSecretIndex = Math.max(...specialDefs.map((d, i) => (!d.secret ? i : -1)))
      expect(Math.min(...secretIndices)).toBeGreaterThan(lastNonSecretIndex)
    })
  })
})

describe('TITLE_DEFS (Ver.6 Phase 10: Achievementと1対1の68個 → item 104-109で76個 → item 129で77個)', () => {
  it('合計77個である', () => {
    expect(TITLE_DEFS).toHaveLength(77)
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

  it('rarityの内訳が設計どおり（item 128でendlessAdvanced50をLEGENDARY→MYTHICへ、item 129でgrindPlay500をEPIC→LEGENDARYへ繰り上げ、grindPlay300をEPICとして新設: COMMON24・RARE24・EPIC15・LEGENDARY8・MYTHIC6＝全77）', () => {
    const counts = TITLE_DEFS.reduce<Record<string, number>>((acc, t) => {
      acc[t.rarity] = (acc[t.rarity] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ common: 24, rare: 24, epic: 15, legendary: 8, mythic: 6 })
  })

  it('MYTHICはドパガキの神/250勝/1000プレイ/鏡写し/大逆転/人間卒業の6個のみ（全てが同じtierに潰れていない）', () => {
    const mythicIds = TITLE_DEFS.filter((t) => t.rarity === 'mythic')
      .map((t) => t.id)
      .sort()
    expect(mythicIds).toEqual(
      ['battleComeback', 'battleMirrorMatch', 'dopa500', 'grindPlay1000', 'worldBattleWin250', 'endlessAdvanced50'].sort(),
    )
  })
})

/**
 * 次フェーズ（item 128-130、追加最終調整ラウンド）: 今回の個別変更点の専用テスト。
 */
describe('item 128: ENDLESS上級50「人間卒業」MYTHIC化', () => {
  it('Achievement側の名称が変更され、解除条件（advanced streak 50）は無変更', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'endlessAdvanced50')
    expect(def?.name).toBe('人間卒業')
    expect(def?.unlockCondition).toEqual({ type: 'endlessStreak', difficulty: 'advanced', threshold: 50 })
    expect(def?.category).toBe('endless')
    expect(def?.endlessDifficulty).toBe('advanced')
  })

  it('Title側がMYTHICへ繰り上がっている', () => {
    const title = TITLE_DEFS.find((t) => t.id === 'endlessAdvanced50')
    expect(title?.name).toBe('人間卒業')
    expect(title?.rarity).toBe('mythic')
  })

  it('ENDLESS上級ラダーの最後（最もSTREAKが高い）に位置している', () => {
    const advancedIds = ACHIEVEMENT_DEFS.filter((d) => d.endlessDifficulty === 'advanced').map((d) => d.id)
    expect(advancedIds[advancedIds.length - 1]).toBe('endlessAdvanced50')
  })
})

describe('item 129: GRIND 6段階再構成', () => {
  it('10/50/100の3つは据え置き（名称・rarity不変）', () => {
    expect(ACHIEVEMENT_DEFS.find((d) => d.id === 'grindPlay10')?.name).toBe('常連')
    expect(ACHIEVEMENT_DEFS.find((d) => d.id === 'grindPlay50')?.name).toBe('沼の入口')
    expect(ACHIEVEMENT_DEFS.find((d) => d.id === 'grindPlay100')?.name).toBe('ドパ中毒')
    expect(TITLE_DEFS.find((t) => t.id === 'grindPlay10')?.rarity).toBe('common')
    expect(TITLE_DEFS.find((t) => t.id === 'grindPlay50')?.rarity).toBe('common')
    expect(TITLE_DEFS.find((t) => t.id === 'grindPlay100')?.rarity).toBe('rare')
  })

  it('grindPlay300が新設されている（閾値300、EPIC）', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'grindPlay300')
    expect(def?.name).toBe('ドパ漬け')
    expect(def?.unlockCondition).toEqual({ type: 'officialPlayCount', threshold: 300 })
    const title = TITLE_DEFS.find((t) => t.id === 'grindPlay300')
    expect(title?.rarity).toBe('epic')
  })

  it('grindPlay500は改名+LEGENDARYへ、grindPlay1000は改名（rarityはMYTHICのまま）、閾値はどちらも無変更', () => {
    const def500 = ACHIEVEMENT_DEFS.find((d) => d.id === 'grindPlay500')
    expect(def500?.name).toBe('廃ドパ民')
    expect(def500?.unlockCondition).toEqual({ type: 'officialPlayCount', threshold: 500 })
    expect(TITLE_DEFS.find((t) => t.id === 'grindPlay500')?.rarity).toBe('legendary')

    const def1000 = ACHIEVEMENT_DEFS.find((d) => d.id === 'grindPlay1000')
    expect(def1000?.name).toBe('THE ドパガキ')
    expect(def1000?.unlockCondition).toEqual({ type: 'officialPlayCount', threshold: 1000 })
    expect(TITLE_DEFS.find((t) => t.id === 'grindPlay1000')?.rarity).toBe('mythic')
  })
})

describe('item 130: SECRET未解放/解放の表示切り替え', () => {
  it('鏡写し・大逆転のdescriptionはもう固定文字列「？？？」ではなく、実際の条件文が入っている', () => {
    const mirror = ACHIEVEMENT_DEFS.find((d) => d.id === 'battleMirrorMatch')
    const comeback = ACHIEVEMENT_DEFS.find((d) => d.id === 'battleComeback')
    expect(mirror?.description).not.toBe('？？？')
    expect(comeback?.description).not.toBe('？？？')
    expect(mirror?.description.length).toBeGreaterThan(0)
    expect(comeback?.description.length).toBeGreaterThan(0)
  })

  it('鏡写し・大逆転には答えを明かさない方向性だけのhintが設定されている', () => {
    const mirror = ACHIEVEMENT_DEFS.find((d) => d.id === 'battleMirrorMatch')
    const comeback = ACHIEVEMENT_DEFS.find((d) => d.id === 'battleComeback')
    expect(mirror?.hint).toBeTruthy()
    expect(comeback?.hint).toBeTruthy()
    // hintが実際の判定条件の核心（5項目/完全一致/DOPA%差等の具体的な仕組み）をそのまま書いていない
    // ことの最低限の確認（答えそのものの専門語を含まない）。
    expect(mirror?.hint).not.toMatch(/5項目|完全一致/)
    expect(comeback?.hint).not.toMatch(/DOPA%|ビハインド/)
  })

  it('secretでない通常実績にはhintが設定されていない', () => {
    const normal = ACHIEVEMENT_DEFS.find((d) => d.id === 'noMiss100')
    expect(normal?.secret).toBeFalsy()
    expect(normal?.hint).toBeUndefined()
  })
})
