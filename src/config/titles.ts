import { NEW_DOPA_TYPE_TIERS } from './dopaType'
import type { AchievementId, TitleDef, TitleRarity } from '../types'

/**
 * Ver.6 Phase 10（実績拡張ラウンド）: Title（称号）の定義。計68個、各Achievementと1対1
 * （achievements.test.tsでACHIEVEMENT_DEFSとTITLE_DEFSが同じ個数・同じID集合であることを
 * 保証する）。TitleDef.idは常にAchievementIdと同じ文字列を使う単純な1対1規約のまま
 * （型上はTitleId=stringで独立しているが、運用上は常に一致させる）。
 *
 * 既存24個（DOPA%系12・Endless系12）のid/nameは一切変更していない。ENDLESS Challenge
 * 専用2個（endlessChallengeFirstWin/endlessChallengeFirstDefense）はVer.6 Phase 8で
 * Achievementは追加済みだったがTitleが未追加だったため、今回のラウンドで初めて追加する
 * （Achievement/Titleが1:1でなかった既存の不整合を解消）。
 *
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 8）: 68個全てにrarityを付与した。
 * 単純な一律の閾値割りではなく、カテゴリごとの実際の達成難易度（連続正解数・通算勝利数・
 * 必要プレイ回数・secret実績かどうか等）を見て個別に判断している。内訳（合計68）：
 * COMMON19・RARE23・EPIC14・LEGENDARY7・MYTHIC5。
 *
 * MYTHIC（5個、ユーザー指示の具体例と一致）: dopa500（"真・ドパガキ"——通常progression
 * ラインの最終到達点であり、単なる閾値達成ではなく物語上の到達点として別格に扱う）、
 * worldBattleWin250、grindPlay1000、battleMirrorMatch（secret）、battleComeback（secret）。
 * LEGENDARY（7個、ユーザー例示の500%系はdopa500をMYTHICへ繰り上げた分、450/490で代替）:
 * dopa450・dopa490・endlessAdvanced30・endlessAdvanced50・challengeWin50・
 * worldBattleWin100・worldBattleStreak20。
 */
export const TITLE_DEFS: TitleDef[] = [
  // Normal / LIMIT BREAK
  { id: 'dopa50', name: 'ドパの芽', description: 'DOPA度50%に到達した証', unlockedByAchievementId: 'dopa50', rarity: 'common' },
  { id: 'dopa100', name: 'ドパガキ見習い', description: 'DOPA度100%に到達した証', unlockedByAchievementId: 'dopa100', rarity: 'common' },
  { id: 'dopa120', name: 'ここから本番', description: 'DOPA度120%に到達した証', unlockedByAchievementId: 'dopa120', rarity: 'common' },
  { id: 'dopa150', name: '加速するガキ', description: 'DOPA度150%に到達した証', unlockedByAchievementId: 'dopa150', rarity: 'common' },
  { id: 'dopa200', name: '完全突破', description: 'DOPA度200%に到達した証', unlockedByAchievementId: 'dopa200', rarity: 'rare' },
  { id: 'dopa250', name: 'LIMIT BREAKER', description: 'DOPA度250%に到達した証', unlockedByAchievementId: 'dopa250', rarity: 'rare' },
  { id: 'dopa300', name: 'OVERLOAD', description: 'DOPA度300%に到達した証', unlockedByAchievementId: 'dopa300', rarity: 'epic' },
  { id: 'dopa350', name: '制御不能', description: 'DOPA度350%に到達した証', unlockedByAchievementId: 'dopa350', rarity: 'epic' },
  { id: 'dopa400', name: '危険区域の住人', description: 'DOPA度400%に到達した証', unlockedByAchievementId: 'dopa400', rarity: 'epic' },
  { id: 'dopa450', name: 'あと50が遠い', description: 'DOPA度450%に到達した証', unlockedByAchievementId: 'dopa450', rarity: 'legendary' },
  { id: 'dopa490', name: '最後の一問', description: '500%チャレンジのFINAL QUESTION（490%）に到達した証', unlockedByAchievementId: 'dopa490', rarity: 'legendary' },
  // 次フェーズ（item 104-105）: DOPA TYPE正式名称の単一定義（config/dopaType.ts）に合わせ、
  // 「真・ドパガキ」から「ドパガキの神」へ改名した（id/unlockedByAchievementId/rarityは
  // 一切変更していない）。
  { id: 'dopa500', name: 'ドパガキの神', description: 'DOPA度500%に到達した証', unlockedByAchievementId: 'dopa500', rarity: 'mythic' },

  /**
   * 次フェーズ（item 104-109）: DOPA TYPE（config/dopaType.tsの単一定義）の8帯に対応する
   * 新規Title。レアリティは近い旧DOPA%閾値Title（上記dopa50〜dopa500）の並びに揃えた
   * （0〜199%帯はdopa50/100/120/150と同じcommon、200〜299はdopa200/250と同じrare、
   * 300〜399はdopa300/350と同じepic、400〜499はdopa400/450の中間としてlegendary）。
   */
  ...NEW_DOPA_TYPE_TIERS.map((tier): TitleDef => {
    const rarityById: Record<string, TitleRarity> = {
      dopaTypeReason: 'common',
      dopaTypeImpatient: 'common',
      dopaTypeReflex: 'common',
      dopaTypeWild: 'common',
      dopaTypeAwakened: 'common',
      dopaTypeAce: 'rare',
      dopaTypeLegend: 'epic',
      dopaTypeKing: 'legendary',
    }
    return {
      id: tier.id,
      name: tier.name,
      description: `公式DOPA RUSHでDOPA度${tier.min}〜${tier.max}%の結果を出した証`,
      unlockedByAchievementId: tier.id as AchievementId,
      rarity: rarityById[tier.id],
    }
  }),

  // ENDLESS
  { id: 'endlessBeginner10', name: '助走完了', description: 'ENDLESS初級で10連続正解した証', unlockedByAchievementId: 'endlessBeginner10', rarity: 'common' },
  { id: 'endlessBeginner25', name: '止まらない指', description: 'ENDLESS初級で25連続正解した証', unlockedByAchievementId: 'endlessBeginner25', rarity: 'common' },
  { id: 'endlessBeginner50', name: '流れに乗った', description: 'ENDLESS初級で50連続正解した証', unlockedByAchievementId: 'endlessBeginner50', rarity: 'rare' },
  { id: 'endlessBeginner100', name: '永久機関', description: 'ENDLESS初級で100連続正解した証', unlockedByAchievementId: 'endlessBeginner100', rarity: 'rare' },
  { id: 'endlessBeginner150', name: '初級の終わらせ方', description: 'ENDLESS初級で150連続正解した証', unlockedByAchievementId: 'endlessBeginner150', rarity: 'epic' },

  { id: 'endlessIntermediate5', name: '集中開始', description: 'ENDLESS中級で5連続正解した証', unlockedByAchievementId: 'endlessIntermediate5', rarity: 'common' },
  { id: 'endlessIntermediate15', name: '研ぎ澄まされた', description: 'ENDLESS中級で15連続正解した証', unlockedByAchievementId: 'endlessIntermediate15', rarity: 'rare' },
  { id: 'endlessIntermediate30', name: '無呼吸', description: 'ENDLESS中級で30連続正解した証', unlockedByAchievementId: 'endlessIntermediate30', rarity: 'rare' },
  { id: 'endlessIntermediate50', name: '中級支配者', description: 'ENDLESS中級で50連続正解した証', unlockedByAchievementId: 'endlessIntermediate50', rarity: 'epic' },
  { id: 'endlessIntermediate75', name: '集中の化身', description: 'ENDLESS中級で75連続正解した証', unlockedByAchievementId: 'endlessIntermediate75', rarity: 'epic' },

  { id: 'endlessAdvanced3', name: '危険区域へようこそ', description: 'ENDLESS上級で3連続正解した証', unlockedByAchievementId: 'endlessAdvanced3', rarity: 'rare' },
  { id: 'endlessAdvanced10', name: '逆転脳', description: 'ENDLESS上級で10連続正解した証', unlockedByAchievementId: 'endlessAdvanced10', rarity: 'epic' },
  { id: 'endlessAdvanced20', name: '赤信号無視', description: 'ENDLESS上級で20連続正解した証', unlockedByAchievementId: 'endlessAdvanced20', rarity: 'epic' },
  { id: 'endlessAdvanced30', name: 'DANGER SURVIVOR', description: 'ENDLESS上級で30連続正解した証', unlockedByAchievementId: 'endlessAdvanced30', rarity: 'legendary' },
  { id: 'endlessAdvanced50', name: '狂気の上級者', description: 'ENDLESS上級で50連続正解した証', unlockedByAchievementId: 'endlessAdvanced50', rarity: 'legendary' },

  // Challenge
  { id: 'challengeCreatedFirst', name: '挑戦状、投函', description: 'Challengeを初めて作成した証', unlockedByAchievementId: 'challengeCreatedFirst', rarity: 'common' },
  { id: 'challengeParticipatedFirst', name: '受けて立つ', description: 'Challengeに初めて参加した証', unlockedByAchievementId: 'challengeParticipatedFirst', rarity: 'common' },
  { id: 'challengeWin1', name: '記録破り', description: 'Challengeで挑戦者として初勝利した証', unlockedByAchievementId: 'challengeWin1', rarity: 'common' },
  { id: 'challengeWin5', name: '刺客', description: 'Challengeで挑戦者として通算5勝した証', unlockedByAchievementId: 'challengeWin5', rarity: 'rare' },
  { id: 'challengeWin20', name: '破壊者', description: 'Challengeで挑戦者として通算20勝した証', unlockedByAchievementId: 'challengeWin20', rarity: 'rare' },
  { id: 'challengeWin50', name: '挑戦状クラッシャー', description: 'Challengeで挑戦者として通算50勝した証', unlockedByAchievementId: 'challengeWin50', rarity: 'legendary' },
  { id: 'challengeDefense1', name: '初防衛', description: 'Challengeの作成者として初めて防衛した証', unlockedByAchievementId: 'challengeDefense1', rarity: 'common' },
  { id: 'challengeDefense10', name: '門番', description: 'Challengeの作成者として通算10回防衛した証', unlockedByAchievementId: 'challengeDefense10', rarity: 'rare' },
  { id: 'challengeDefense25', name: '難攻不落', description: 'Challengeの作成者として通算25回防衛した証', unlockedByAchievementId: 'challengeDefense25', rarity: 'epic' },
  { id: 'challengeWanted10', name: '指名手配', description: '1つのChallengeに10人以上の挑戦者を集めた証', unlockedByAchievementId: 'challengeWanted10', rarity: 'epic' },
  { id: 'endlessChallengeFirstWin', name: '終わらない挑戦者', description: 'ENDLESS Challengeで初めてホストの記録を超えた証', unlockedByAchievementId: 'endlessChallengeFirstWin', rarity: 'rare' },
  { id: 'endlessChallengeFirstDefense', name: '終わらない門番', description: 'ENDLESS Challengeで初めて自分の記録を守り切った証', unlockedByAchievementId: 'endlessChallengeFirstDefense', rarity: 'rare' },

  // World Battle
  { id: 'worldBattleFirstPlay', name: '世界デビュー', description: '世界対戦に初めて参加した証', unlockedByAchievementId: 'worldBattleFirstPlay', rarity: 'common' },
  { id: 'worldBattleWin1', name: '初陣勝利', description: '世界対戦で初めて勝利した証', unlockedByAchievementId: 'worldBattleWin1', rarity: 'common' },
  { id: 'worldBattleWin10', name: '世界に慣れた', description: '世界対戦で通算10勝した証', unlockedByAchievementId: 'worldBattleWin10', rarity: 'rare' },
  { id: 'worldBattleWin25', name: '勝ち癖', description: '世界対戦で通算25勝した証', unlockedByAchievementId: 'worldBattleWin25', rarity: 'rare' },
  { id: 'worldBattleWin50', name: '世界の壁', description: '世界対戦で通算50勝した証', unlockedByAchievementId: 'worldBattleWin50', rarity: 'epic' },
  { id: 'worldBattleWin100', name: '百勝ドパガキ', description: '世界対戦で通算100勝した証', unlockedByAchievementId: 'worldBattleWin100', rarity: 'legendary' },
  { id: 'worldBattleWin250', name: '世界征服', description: '世界対戦で通算250勝した証', unlockedByAchievementId: 'worldBattleWin250', rarity: 'mythic' },
  { id: 'worldBattleStreak3', name: '三連撃', description: '世界対戦で3連勝した証', unlockedByAchievementId: 'worldBattleStreak3', rarity: 'common' },
  { id: 'worldBattleStreak5', name: '止められない', description: '世界対戦で5連勝した証', unlockedByAchievementId: 'worldBattleStreak5', rarity: 'rare' },
  { id: 'worldBattleStreak10', name: '十連覇', description: '世界対戦で10連勝した証', unlockedByAchievementId: 'worldBattleStreak10', rarity: 'epic' },
  { id: 'worldBattleStreak20', name: '無双', description: '世界対戦で20連勝した証', unlockedByAchievementId: 'worldBattleStreak20', rarity: 'legendary' },
  { id: 'worldBattleFirstDraw', name: '好敵手', description: '世界対戦で初めてDRAWになった証', unlockedByAchievementId: 'worldBattleFirstDraw', rarity: 'common' },

  // Friend Battle
  { id: 'friendBattleFirstPlay', name: '身内戦争', description: 'フレンド対戦に初めて参加した証', unlockedByAchievementId: 'friendBattleFirstPlay', rarity: 'common' },
  { id: 'friendBattlePlay10', name: 'いつメン', description: 'フレンド対戦に通算10回参加した証', unlockedByAchievementId: 'friendBattlePlay10', rarity: 'common' },
  { id: 'friendBattlePlay50', name: '腐れ縁', description: 'フレンド対戦に通算50回参加した証', unlockedByAchievementId: 'friendBattlePlay50', rarity: 'rare' },
  { id: 'friendBattlePlay100', name: '終わらない放課後', description: 'フレンド対戦に通算100回参加した証', unlockedByAchievementId: 'friendBattlePlay100', rarity: 'rare' },

  // Skill / Special
  { id: 'noMiss100', name: 'ノーミス', description: 'DOPA度100%以上・正答率100%でクリアした証', unlockedByAchievementId: 'noMiss100', rarity: 'rare' },
  { id: 'noMiss200', name: '完全体', description: 'DOPA度200%以上・正答率100%でクリアした証', unlockedByAchievementId: 'noMiss200', rarity: 'epic' },
  { id: 'battleWinByBaseDopa', name: 'ボーナスに頼らない', description: '世界対戦で通常獲得DOPA%の比較で勝利した証', unlockedByAchievementId: 'battleWinByBaseDopa', rarity: 'rare' },
  { id: 'battleWinByAccuracy', name: '正確無比', description: '世界対戦で正答率の比較で勝利した証', unlockedByAchievementId: 'battleWinByAccuracy', rarity: 'rare' },
  { id: 'battleWinByMaxCombo', name: '連鎖の鬼', description: '世界対戦で最大COMBOの比較で勝利した証', unlockedByAchievementId: 'battleWinByMaxCombo', rarity: 'rare' },
  { id: 'battleWinByReaction', name: '反射神経バケモノ', description: '世界対戦で反応速度の比較で勝利した証', unlockedByAchievementId: 'battleWinByReaction', rarity: 'rare' },
  { id: 'battleMirrorMatch', name: '鏡写し', description: '世界対戦で5項目が完全一致しDRAWになった証', unlockedByAchievementId: 'battleMirrorMatch', rarity: 'mythic' },
  { id: 'battleComeback', name: '大逆転', description: '世界対戦で大きく離されてから逆転勝利した証', unlockedByAchievementId: 'battleComeback', rarity: 'mythic' },

  // Grind
  { id: 'grindPlay10', name: '常連', description: '公式プレイを通算10回行った証', unlockedByAchievementId: 'grindPlay10', rarity: 'common' },
  { id: 'grindPlay50', name: '沼の入口', description: '公式プレイを通算50回行った証', unlockedByAchievementId: 'grindPlay50', rarity: 'common' },
  { id: 'grindPlay100', name: 'ドパ中毒', description: '公式プレイを通算100回行った証', unlockedByAchievementId: 'grindPlay100', rarity: 'rare' },
  { id: 'grindPlay500', name: '抜け出せない', description: '公式プレイを通算500回行った証', unlockedByAchievementId: 'grindPlay500', rarity: 'epic' },
  { id: 'grindPlay1000', name: 'ドパガキ住民', description: '公式プレイを通算1000回行った証', unlockedByAchievementId: 'grindPlay1000', rarity: 'mythic' },
]

export const TITLE_DEFS_BY_ID: Record<string, TitleDef> = Object.fromEntries(TITLE_DEFS.map((def) => [def.id, def]))
