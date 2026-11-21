import type { AchievementDef, AchievementId } from '../types'

/**
 * Ver.6 Phase 10（実績拡張ラウンド）: 実績定義。計68個（7カテゴリ）。
 *
 * Normal/LIMIT BREAK 12・ENDLESS 15・Challenge 12・World Battle 12・Friend Battle 4・
 * Skill/Special 8・Grind 5 ＝ 68（achievements.test.tsで合計・カテゴリ別件数・ID重複なし・
 * Title ID重複なしを保証する）。
 *
 * 互換性: Ver.6 Phase 5.1時点の既存26個（DOPA%系12・Endless系12・ENDLESS Challenge系2）の
 * idは一切変更していない——既に解除済みの既存ユーザーの実績データ（utils/achievementStorage.ts
 * がidだけで管理）を壊さないため。名称（name/description）は元々「達成条件が分かる安全な
 * 仮称」として明示的に未確定のまま残してあったため、今回ここで初めて正式名称を付ける
 * （idとは独立なので解除済みフラグには一切影響しない）。ENDLESS Challenge専用の2個は、
 * 今回の7カテゴリ再編に合わせてcategoryだけを'endless'から'challenge'へ変更した
 * （unlockConditionは一切変更していないため、解除済み状態・判定ロジックへの影響はない）。
 */
const NORMAL_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'dopa50', name: 'ドパの芽', description: '公式DOPA RUSHでDOPA度50%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 50 }, category: 'dopa' },
  { id: 'dopa100', name: 'ドパガキ見習い', description: '公式DOPA RUSHでDOPA度100%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 100 }, category: 'dopa' },
  { id: 'dopa120', name: 'ここから本番', description: '公式DOPA RUSHでDOPA度120%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 120 }, category: 'dopa' },
  { id: 'dopa150', name: '加速するガキ', description: '公式DOPA RUSHでDOPA度150%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 150 }, category: 'dopa' },
  { id: 'dopa200', name: '完全突破', description: '公式DOPA RUSHでDOPA度200%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 200 }, category: 'dopa' },
  { id: 'dopa250', name: 'LIMIT BREAKER', description: '公式DOPA RUSHでDOPA度250%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 250 }, category: 'dopa' },
  { id: 'dopa300', name: 'OVERLOAD', description: '公式DOPA RUSHでDOPA度300%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 300 }, category: 'dopa' },
  { id: 'dopa350', name: '制御不能', description: '公式DOPA RUSHでDOPA度350%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 350 }, category: 'dopa' },
  { id: 'dopa400', name: '危険区域の住人', description: '公式DOPA RUSHでDOPA度400%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 400 }, category: 'dopa' },
  { id: 'dopa450', name: 'あと50が遠い', description: '公式DOPA RUSHでDOPA度450%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 450 }, category: 'dopa' },
  // 490はMISSで400へ・正解で500へ即座に遷移し、bestPercentとして490そのものが記録されることが
  // ないため、専用のchallenge500FinalQuestion条件（engine/challenge500Engine.tsのreached490）で判定する。
  {
    id: 'dopa490',
    name: '最後の一問',
    description: '500%チャレンジでFINAL QUESTION（490%）に到達する',
    unlockCondition: { type: 'challenge500FinalQuestion' },
    category: 'dopa',
  },
  { id: 'dopa500', name: '真・ドパガキ', description: '公式DOPA RUSHでDOPA度500%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 500 }, category: 'dopa', rarity: 'rare' },
]

const ENDLESS_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'endlessBeginner10', name: '助走完了', description: 'ENDLESS初級で10連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 10 }, category: 'endless', endlessDifficulty: 'beginner' },
  { id: 'endlessBeginner25', name: '止まらない指', description: 'ENDLESS初級で25連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 25 }, category: 'endless', endlessDifficulty: 'beginner' },
  { id: 'endlessBeginner50', name: '流れに乗った', description: 'ENDLESS初級で50連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 50 }, category: 'endless', endlessDifficulty: 'beginner' },
  { id: 'endlessBeginner100', name: '永久機関', description: 'ENDLESS初級で100連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 100 }, category: 'endless', endlessDifficulty: 'beginner' },
  { id: 'endlessBeginner150', name: '初級の終わらせ方', description: 'ENDLESS初級で150連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'beginner', threshold: 150 }, category: 'endless', endlessDifficulty: 'beginner' },

  { id: 'endlessIntermediate5', name: '集中開始', description: 'ENDLESS中級で5連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 5 }, category: 'endless', endlessDifficulty: 'intermediate' },
  { id: 'endlessIntermediate15', name: '研ぎ澄まされた', description: 'ENDLESS中級で15連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 15 }, category: 'endless', endlessDifficulty: 'intermediate' },
  { id: 'endlessIntermediate30', name: '無呼吸', description: 'ENDLESS中級で30連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 30 }, category: 'endless', endlessDifficulty: 'intermediate' },
  { id: 'endlessIntermediate50', name: '中級支配者', description: 'ENDLESS中級で50連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 50 }, category: 'endless', endlessDifficulty: 'intermediate' },
  { id: 'endlessIntermediate75', name: '集中の化身', description: 'ENDLESS中級で75連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 75 }, category: 'endless', endlessDifficulty: 'intermediate' },

  { id: 'endlessAdvanced3', name: '危険区域へようこそ', description: 'ENDLESS上級で3連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 3 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced10', name: '逆転脳', description: 'ENDLESS上級で10連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 10 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced20', name: '赤信号無視', description: 'ENDLESS上級で20連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 20 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced30', name: 'DANGER SURVIVOR', description: 'ENDLESS上級で30連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 30 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced50', name: '狂気の上級者', description: 'ENDLESS上級で50連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 50 }, category: 'endless', endlessDifficulty: 'advanced' },
]

/**
 * Challenge 12個。endlessChallengeFirstWin/endlessChallengeFirstDefenseはVer.6 Phase 8で
 * 既に実装済み（unlockConditionは変更しない）。残り10個は今回新規追加。
 * 通常Challenge・ENDLESS Challengeの勝利/防衛はchallengeWinCount/challengeDefenseCountへ
 * 合算されるが、終わらない挑戦者/終わらない門番はENDLESS Challenge限定のendlessChallengeWin/
 * endlessChallengeDefense条件のまま（item 27のユーザー指示どおり）。
 */
const CHALLENGE_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'challengeCreatedFirst', name: '挑戦状、投函', description: 'Challengeを初めて作成する', unlockCondition: { type: 'challengeCreated' }, category: 'challenge' },
  { id: 'challengeParticipatedFirst', name: '受けて立つ', description: 'Challengeに初めて参加する', unlockCondition: { type: 'challengeParticipated' }, category: 'challenge' },
  { id: 'challengeWin1', name: '記録破り', description: 'Challengeで挑戦者として初勝利する', unlockCondition: { type: 'challengeWinCount', threshold: 1 }, category: 'challenge' },
  { id: 'challengeWin5', name: '刺客', description: 'Challengeで挑戦者として通算5勝する', unlockCondition: { type: 'challengeWinCount', threshold: 5 }, category: 'challenge' },
  { id: 'challengeWin20', name: '破壊者', description: 'Challengeで挑戦者として通算20勝する', unlockCondition: { type: 'challengeWinCount', threshold: 20 }, category: 'challenge' },
  { id: 'challengeWin50', name: '挑戦状クラッシャー', description: 'Challengeで挑戦者として通算50勝する', unlockCondition: { type: 'challengeWinCount', threshold: 50 }, category: 'challenge' },
  { id: 'challengeDefense1', name: '初防衛', description: 'Challengeの作成者として初めて防衛（挑戦者をLOSEさせる）する', unlockCondition: { type: 'challengeDefenseCount', threshold: 1 }, category: 'challenge' },
  { id: 'challengeDefense10', name: '門番', description: 'Challengeの作成者として通算10回防衛する', unlockCondition: { type: 'challengeDefenseCount', threshold: 10 }, category: 'challenge' },
  { id: 'challengeDefense25', name: '難攻不落', description: 'Challengeの作成者として通算25回防衛する', unlockCondition: { type: 'challengeDefenseCount', threshold: 25 }, category: 'challenge' },
  { id: 'challengeWanted10', name: '指名手配', description: '自分の1つのChallengeに10人以上の異なる挑戦者が挑む', unlockCondition: { type: 'challengeWanted' }, category: 'challenge' },
  {
    id: 'endlessChallengeFirstWin',
    name: '終わらない挑戦者',
    description: 'ENDLESS Challengeで初めてホストの記録を超える',
    unlockCondition: { type: 'endlessChallengeWin' },
    category: 'challenge',
  },
  {
    id: 'endlessChallengeFirstDefense',
    name: '終わらない門番',
    description: 'ENDLESS Challengeで初めて自分の記録を守り切る',
    unlockCondition: { type: 'endlessChallengeDefense' },
    category: 'challenge',
  },
]

const WORLD_BATTLE_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'worldBattleFirstPlay', name: '世界デビュー', description: '世界対戦に初めて参加する', unlockCondition: { type: 'worldBattleFirstPlay' }, category: 'worldBattle' },
  { id: 'worldBattleWin1', name: '初陣勝利', description: '世界対戦で初めて勝利する', unlockCondition: { type: 'worldBattleWinCount', threshold: 1 }, category: 'worldBattle' },
  { id: 'worldBattleWin10', name: '世界に慣れた', description: '世界対戦で通算10勝する', unlockCondition: { type: 'worldBattleWinCount', threshold: 10 }, category: 'worldBattle' },
  { id: 'worldBattleWin25', name: '勝ち癖', description: '世界対戦で通算25勝する', unlockCondition: { type: 'worldBattleWinCount', threshold: 25 }, category: 'worldBattle' },
  { id: 'worldBattleWin50', name: '世界の壁', description: '世界対戦で通算50勝する', unlockCondition: { type: 'worldBattleWinCount', threshold: 50 }, category: 'worldBattle' },
  { id: 'worldBattleWin100', name: '百勝ドパガキ', description: '世界対戦で通算100勝する', unlockCondition: { type: 'worldBattleWinCount', threshold: 100 }, category: 'worldBattle', rarity: 'rare' },
  { id: 'worldBattleWin250', name: '世界征服', description: '世界対戦で通算250勝する', unlockCondition: { type: 'worldBattleWinCount', threshold: 250 }, category: 'worldBattle', rarity: 'rare' },
  { id: 'worldBattleStreak3', name: '三連撃', description: '世界対戦で3連勝する', unlockCondition: { type: 'worldBattleStreak', threshold: 3 }, category: 'worldBattle' },
  { id: 'worldBattleStreak5', name: '止められない', description: '世界対戦で5連勝する', unlockCondition: { type: 'worldBattleStreak', threshold: 5 }, category: 'worldBattle' },
  { id: 'worldBattleStreak10', name: '十連覇', description: '世界対戦で10連勝する', unlockCondition: { type: 'worldBattleStreak', threshold: 10 }, category: 'worldBattle' },
  { id: 'worldBattleStreak20', name: '無双', description: '世界対戦で20連勝する', unlockCondition: { type: 'worldBattleStreak', threshold: 20 }, category: 'worldBattle', rarity: 'rare' },
  { id: 'worldBattleFirstDraw', name: '好敵手', description: '世界対戦で初めてDRAWになる', unlockCondition: { type: 'worldBattleFirstDraw' }, category: 'worldBattle' },
]

const FRIEND_BATTLE_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'friendBattleFirstPlay', name: '身内戦争', description: 'フレンド対戦に初めて参加する', unlockCondition: { type: 'friendBattleFirstPlay' }, category: 'friendBattle' },
  { id: 'friendBattlePlay10', name: 'いつメン', description: 'フレンド対戦に通算10回参加する', unlockCondition: { type: 'friendBattlePlayCount', threshold: 10 }, category: 'friendBattle' },
  { id: 'friendBattlePlay50', name: '腐れ縁', description: 'フレンド対戦に通算50回参加する', unlockCondition: { type: 'friendBattlePlayCount', threshold: 50 }, category: 'friendBattle' },
  { id: 'friendBattlePlay100', name: '終わらない放課後', description: 'フレンド対戦に通算100回参加する', unlockCondition: { type: 'friendBattlePlayCount', threshold: 100 }, category: 'friendBattle' },
]

/**
 * Skill/Special 8個。鏡写し・大逆転は条件を事前に見せない方が面白いためsecret扱い
 * （item 12のユーザー指示：「全てをSecretにはしない」ため、ノーミス/完全体/ボーナスに
 * 頼らない系4つは条件を通常どおり表示する）。
 */
const SPECIAL_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'noMiss100', name: 'ノーミス', description: '公式DOPA RUSHでDOPA度100%以上に到達し、正答率100%でクリアする', unlockCondition: { type: 'noMiss', threshold: 100 }, category: 'special' },
  { id: 'noMiss200', name: '完全体', description: '公式DOPA RUSHでDOPA度200%以上に到達し、正答率100%でクリアする', unlockCondition: { type: 'noMiss', threshold: 200 }, category: 'special' },
  { id: 'battleWinByBaseDopa', name: 'ボーナスに頼らない', description: '世界対戦で、通常獲得DOPA%の比較で勝敗が決まり勝利する', unlockCondition: { type: 'battleDecidingStat', stat: 'baseDopaPercent' }, category: 'special' },
  { id: 'battleWinByAccuracy', name: '正確無比', description: '世界対戦で、正答率の比較で勝敗が決まり勝利する', unlockCondition: { type: 'battleDecidingStat', stat: 'accuracy' }, category: 'special' },
  { id: 'battleWinByMaxCombo', name: '連鎖の鬼', description: '世界対戦で、最大COMBOの比較で勝敗が決まり勝利する', unlockCondition: { type: 'battleDecidingStat', stat: 'maxCombo' }, category: 'special' },
  { id: 'battleWinByReaction', name: '反射神経バケモノ', description: '世界対戦で、正解時反応速度中央値の比較で勝敗が決まり勝利する', unlockCondition: { type: 'battleDecidingStat', stat: 'medianCorrectReactionMs' }, category: 'special' },
  { id: 'battleMirrorMatch', name: '鏡写し', description: '？？？', unlockCondition: { type: 'battleMirror' }, category: 'special', secret: true, rarity: 'rare' },
  { id: 'battleComeback', name: '大逆転', description: '？？？', unlockCondition: { type: 'battleComeback' }, category: 'special', secret: true, rarity: 'rare' },
]

const GRIND_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'grindPlay10', name: '常連', description: '公式プレイ（DOPA RUSH・ENDLESS・世界対戦・フレンド対戦）を通算10回行う', unlockCondition: { type: 'officialPlayCount', threshold: 10 }, category: 'grind' },
  { id: 'grindPlay50', name: '沼の入口', description: '公式プレイを通算50回行う', unlockCondition: { type: 'officialPlayCount', threshold: 50 }, category: 'grind' },
  { id: 'grindPlay100', name: 'ドパ中毒', description: '公式プレイを通算100回行う', unlockCondition: { type: 'officialPlayCount', threshold: 100 }, category: 'grind' },
  { id: 'grindPlay500', name: '抜け出せない', description: '公式プレイを通算500回行う', unlockCondition: { type: 'officialPlayCount', threshold: 500 }, category: 'grind' },
  { id: 'grindPlay1000', name: 'ドパガキ住民', description: '公式プレイを通算1000回行う', unlockCondition: { type: 'officialPlayCount', threshold: 1000 }, category: 'grind', rarity: 'rare' },
]

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  ...NORMAL_ACHIEVEMENTS,
  ...ENDLESS_ACHIEVEMENTS,
  ...CHALLENGE_ACHIEVEMENTS,
  ...WORLD_BATTLE_ACHIEVEMENTS,
  ...FRIEND_BATTLE_ACHIEVEMENTS,
  ...SPECIAL_ACHIEVEMENTS,
  ...GRIND_ACHIEVEMENTS,
]

export const ACHIEVEMENT_DEFS_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((def) => [def.id, def]),
) as Record<AchievementId, AchievementDef>
