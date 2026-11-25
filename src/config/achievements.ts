import { NEW_DOPA_TYPE_TIERS } from './dopaType'
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
  // 次フェーズ（item 104-105）: DOPA TYPE正式名称の単一定義（config/dopaType.ts）に合わせ、
  // 「真・ドパガキ」から「ドパガキの神」へ改名した（新規Achievement重複作成はしない。
  // id/unlockCondition/rarityは一切変更していないため、既存ユーザーの解除済み状態への影響は無い）。
  { id: 'dopa500', name: 'ドパガキの神', description: '公式DOPA RUSHでDOPA度500%に到達する', unlockCondition: { type: 'dopaPercent', threshold: 500 }, category: 'dopa', rarity: 'rare' },
]

/**
 * 次フェーズ（item 104-109）: DOPA TYPE（config/dopaType.tsの単一定義）の8帯に対応する
 * 新規実績。各TYPEの該当DOPA%帯に実際にその結果が収まった場合だけ解除する
 * （dopaPercentBand、achievementStorage.tsのcheckDopaTypeBandAchievements参照——
 * 既存のdopaPercent系「以上なら全部解除」の累積判定とは異なり、高いDOPA%を出した
 * からといって下位TYPEを一括解除しない）。500%用は追加しない（既存dopa500の改名で対応済み）。
 */
const DOPA_TYPE_ACHIEVEMENTS: AchievementDef[] = NEW_DOPA_TYPE_TIERS.map(
  (tier): AchievementDef => ({
    id: tier.id as AchievementId,
    name: tier.name,
    description: `公式DOPA RUSHでDOPA度${tier.min}〜${tier.max}%の結果を出す`,
    unlockCondition: { type: 'dopaPercentBand', min: tier.min, max: tier.max },
    category: 'dopa',
  }),
)

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
  // 次フェーズ（item 142、大型最終仕上げラウンド）: 中級ラダーの新6段目。解除条件は既存の
  // endlessStreak型をそのまま使う（新しい条件種別は不要）。
  { id: 'endlessIntermediate100', name: '無我の境地', description: 'ENDLESS中級で100連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'intermediate', threshold: 100 }, category: 'endless', endlessDifficulty: 'intermediate' },

  { id: 'endlessAdvanced3', name: '危険区域へようこそ', description: 'ENDLESS上級で3連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 3 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced10', name: '逆転脳', description: 'ENDLESS上級で10連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 10 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced20', name: '赤信号無視', description: 'ENDLESS上級で20連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 20 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced30', name: 'DANGER SURVIVOR', description: 'ENDLESS上級で30連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 30 }, category: 'endless', endlessDifficulty: 'advanced' },
  { id: 'endlessAdvanced50', name: '人間卒業', description: 'ENDLESS上級で50連続正解する', unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 50 }, category: 'endless', endlessDifficulty: 'advanced' },
]

/**
 * 次フェーズ（item 137-141、大型最終仕上げラウンド）: ENDLESS専用SECRET2個。通常ラダー
 * には混ぜず末尾に追加する（SECRETの存在を隠す既存方針どおり）。
 * - 三冠王: 初級150・中級100（上記の無我の境地）・上級50の3つの自己ベストを同時に満たす
 *   （endlessStreak型では表現できない複合条件のため、専用のendlessTripleCrown型を新設）。
 * - 人外認定: 上級100連続正解。表のラダーの上級MAXは50（人間卒業/MYTHIC）のまま——既存の
 *   endlessStreak型をそのまま使い、表には一切出さずsecretとしてだけ存在させる。
 */
const ENDLESS_SECRET_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'endlessTripleCrown',
    name: '三冠王',
    description: 'ENDLESS初級150連続・中級100連続・上級50連続、3つすべての自己ベストを同時に満たす',
    hint: '三つの難易度。その頂点をすべて見た者だけが名乗れる。',
    unlockCondition: { type: 'endlessTripleCrown' },
    category: 'endless',
    secret: true,
  },
  {
    id: 'endlessAdvanced100',
    name: '人外認定',
    description: 'ENDLESS上級で100連続正解する',
    hint: '卒業した先に、まだ続きがあるらしい。',
    unlockCondition: { type: 'endlessStreak', difficulty: 'advanced', threshold: 100 },
    category: 'endless',
    secret: true,
  },
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

/**
 * 次フェーズ（item 137-141、大型最終仕上げラウンド）: Challenge専用SECRET3個。通常ラダー
 * には混ぜず末尾に追加する。
 */
const CHALLENGE_SECRET_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'challengeZeroWall',
    name: '0の壁',
    description: 'ENDLESS Challengeで0 STREAKの挑戦状を作成し、挑戦者も0 STREAKで終えたその挑戦を防衛する',
    hint: '越えるべき壁が、そこにないとしても。',
    unlockCondition: { type: 'challengeZeroStreakDefense' },
    category: 'challenge',
    secret: true,
  },
  {
    id: 'challengeBeatTheGod',
    name: '神越え',
    description: 'DOPA RUSH系Challengeで、相手の基準記録が500%の挑戦状へ挑み、既存のタイブレーク判定も含めて最終的にWINする',
    hint: '神に届くだけでは足りない。その先へ。',
    unlockCondition: { type: 'challengeBeat500' },
    category: 'challenge',
    secret: true,
  },
  {
    id: 'challengeLastBoss',
    name: 'ラスボス',
    description: '自分が作成した1つのChallengeに異なる10人以上が挑戦し、その全員から防衛する（誰にも突破されていない）',
    hint: '挑戦者は多いほどいい。全員返り討ちにできるなら。',
    unlockCondition: { type: 'challengeUndefeated10' },
    category: 'challenge',
    secret: true,
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
 * 次フェーズ（item 137-141、大型最終仕上げラウンド）: フレンド対戦専用SECRET2個。
 * PRIVATE ROOM（友達と対戦）のロビー状態から判定する——通常ラダーには混ぜず末尾に追加する。
 */
const FRIEND_BATTLE_SECRET_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'friendRoomFullHouse',
    name: 'ドパガキ大集合',
    description: 'ルームが8人満員になり、4つのTABLEすべてが同時に対戦進行中になる',
    hint: '4つの卓が、すべて埋まった時——。',
    unlockCondition: { type: 'friendRoomAllTablesActive' },
    category: 'friendBattle',
    secret: true,
  },
  {
    id: 'friendRoomFrenemy',
    name: 'フレネミー',
    description: '同じルーム内で、自分以外の7人全員に最低1回ずつ勝利する',
    hint: 'せっかく集まった7人。全員と仲良くする必要はない。',
    unlockCondition: { type: 'friendRoomBeatAllMembers' },
    category: 'friendBattle',
    secret: true,
  },
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
  /**
   * 次フェーズ（item 130、追加最終調整ラウンド）: descriptionが文字通り'？？？'固定だった
   * 問題を修正——未解放中は従来どおりAchievementScreen/TitleDetailModal側の
   * hidden判定（secret && !unlocked）でこのdescription自体を画面に出さず「？？？」表示へ
   * 差し替えているため、ここに実際の条件文を書いても未解放中に漏れることはない。
   * 解放後は、この本物の条件文がそのまま表示される（TitleDefの既存description
   * 「世界対戦で5項目が完全一致しDRAWになった証」「世界対戦で大きく離されてから逆転勝利した証」
   * と内容を揃えた）。hintは未解放中でも見られる、答えを割らない方向性だけのヒント文
   * （TitleDetailModal.tsxの「？ HINT」ボタンから表示する。新設フィールド、通常実績は未設定）。
   */
  {
    id: 'battleMirrorMatch',
    name: '鏡写し',
    description: '世界対戦で、自分と相手の判定5項目が完全に一致しDRAWになる',
    hint: '勝ちでも負けでもない結末がある。相手と自分が、まるで鏡に映したようにそっくりだったとしたら——？',
    unlockCondition: { type: 'battleMirror' },
    category: 'special',
    secret: true,
    rarity: 'rare',
  },
  /**
   * 次フェーズ（item 141、大型最終仕上げラウンド）: descriptionを、実際の判定コード
   * （BattleMatchScreen.tsxのCOMEBACK_DEFICIT_THRESHOLD=20・maxDeficitRef・
   * finishReason==='completed'判定）と一致する具体文へ書き換えた（条件自体は無変更）。
   */
  {
    id: 'battleComeback',
    name: '大逆転',
    description: '世界対戦で、試合中に相手に20%以上の差をつけられた状態から、切断・棄権なしで最後まで戦い抜き、最終的に逆転勝利する',
    hint: 'どれだけ差をつけられても、試合終了のその瞬間まで諦めなければ見える景色がある。',
    unlockCondition: { type: 'battleComeback' },
    category: 'special',
    secret: true,
    rarity: 'rare',
  },
]

/**
 * 次フェーズ（item 129、追加最終調整ラウンド）: 6段階へ再構成（10/50/100/300/500/1000の
 * 完全昇順）。10/50/100の3つは据え置き（既に適切と確認済み）。新規にgrindPlay300を追加し、
 * 500/1000は改名のみ（idとunlockCondition自体は変更していないため、既存ユーザーの解除済み
 * 状態への影響はない）。
 */
const GRIND_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'grindPlay10', name: '常連', description: '公式プレイ（DOPA RUSH・ENDLESS・世界対戦・フレンド対戦）を通算10回行う', unlockCondition: { type: 'officialPlayCount', threshold: 10 }, category: 'grind' },
  { id: 'grindPlay50', name: '沼の入口', description: '公式プレイを通算50回行う', unlockCondition: { type: 'officialPlayCount', threshold: 50 }, category: 'grind' },
  { id: 'grindPlay100', name: 'ドパ中毒', description: '公式プレイを通算100回行う', unlockCondition: { type: 'officialPlayCount', threshold: 100 }, category: 'grind' },
  { id: 'grindPlay300', name: 'ドパ漬け', description: '公式プレイを通算300回行う', unlockCondition: { type: 'officialPlayCount', threshold: 300 }, category: 'grind' },
  { id: 'grindPlay500', name: '廃ドパ民', description: '公式プレイを通算500回行う', unlockCondition: { type: 'officialPlayCount', threshold: 500 }, category: 'grind' },
  { id: 'grindPlay1000', name: 'THE ドパガキ', description: '公式プレイを通算1000回行う', unlockCondition: { type: 'officialPlayCount', threshold: 1000 }, category: 'grind', rarity: 'rare' },
]

/**
 * 次フェーズ（item 120-122、リリース前最終デザインラウンド）: 'dopa'カテゴリの表示順を
 * 「解除条件のDOPA%で完全昇順」へ整理する。NORMAL_ACHIEVEMENTS（既存12個）と
 * DOPA_TYPE_ACHIEVEMENTS（新規8個）を実装順（既存→追加）のまま連結するのは禁止
 * （ユーザー指示）——同じ%帯の既存マイルストーンとDOPA TYPEを自然に混ぜた1本の
 * 昇順リストに並べ替える。各defの中身（id/name/description/unlockCondition/rarity）は
 * 一切変更せず、ここでは並び順だけを変える。
 */
const NORMAL_BY_ID = Object.fromEntries(NORMAL_ACHIEVEMENTS.map((d) => [d.id, d])) as Record<string, AchievementDef>
const DOPA_TYPE_BY_ID = Object.fromEntries(DOPA_TYPE_ACHIEVEMENTS.map((d) => [d.id, d])) as Record<string, AchievementDef>

const DOPA_CATEGORY_ORDERED: AchievementDef[] = [
  DOPA_TYPE_BY_ID.dopaTypeReason, // 0-24%
  DOPA_TYPE_BY_ID.dopaTypeImpatient, // 25-49%
  NORMAL_BY_ID.dopa50, // 50%
  DOPA_TYPE_BY_ID.dopaTypeReflex, // 50-79%
  DOPA_TYPE_BY_ID.dopaTypeWild, // 80-99%
  NORMAL_BY_ID.dopa100, // 100%
  DOPA_TYPE_BY_ID.dopaTypeAwakened, // 100-199%
  NORMAL_BY_ID.dopa120, // 120%
  NORMAL_BY_ID.dopa150, // 150%
  NORMAL_BY_ID.dopa200, // 200%
  DOPA_TYPE_BY_ID.dopaTypeAce, // 200-299%
  NORMAL_BY_ID.dopa250, // 250%
  NORMAL_BY_ID.dopa300, // 300%
  DOPA_TYPE_BY_ID.dopaTypeLegend, // 300-399%
  NORMAL_BY_ID.dopa350, // 350%
  NORMAL_BY_ID.dopa400, // 400%
  DOPA_TYPE_BY_ID.dopaTypeKing, // 400-499%
  NORMAL_BY_ID.dopa450, // 450%
  NORMAL_BY_ID.dopa500, // 500%
]

/**
 * 次フェーズ（item 137-140、大型最終仕上げラウンド）: 既存dopa490「最後の一問」
 * （490%到達だけで解除）を削除し、代わりにSECRET「全部水の泡」を新設した。490%
 * （FINAL QUESTION）に到達しながら不正解に終わり500%到達を逃した場合だけ解除する
 * （engine/challenge500Engine.tsのstate.reached490 && state.ended && !state.cleared、
 * utils/achievementStorage.tsのcheckChallenge500MissedFinalAchievement参照）。
 * SECRETの存在を隠す既存方針どおり、DOPA%昇順ラダー（DOPA_CATEGORY_ORDERED）には
 * 混ぜず、dopaカテゴリの末尾に追加する。
 */
const DOPA_SECRET_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'dopaFinalWipeout',
    name: '全部水の泡',
    description: '500%チャレンジで、FINAL QUESTION（490%）に到達しながら不正解に終わり、500%到達を逃す',
    hint: 'あと一問。そこまで積み上げたものが、すべて消えることもある。',
    unlockCondition: { type: 'challenge500MissedFinal' },
    category: 'dopa',
    secret: true,
  },
]

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  ...DOPA_CATEGORY_ORDERED,
  ...DOPA_SECRET_ACHIEVEMENTS,
  ...ENDLESS_ACHIEVEMENTS,
  ...ENDLESS_SECRET_ACHIEVEMENTS,
  ...CHALLENGE_ACHIEVEMENTS,
  ...CHALLENGE_SECRET_ACHIEVEMENTS,
  ...WORLD_BATTLE_ACHIEVEMENTS,
  ...FRIEND_BATTLE_ACHIEVEMENTS,
  ...FRIEND_BATTLE_SECRET_ACHIEVEMENTS,
  ...SPECIAL_ACHIEVEMENTS,
  ...GRIND_ACHIEVEMENTS,
]

export const ACHIEVEMENT_DEFS_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((def) => [def.id, def]),
) as Record<AchievementId, AchievementDef>

/**
 * 次フェーズ（item 117-119, 123-124）: TitleId（types.tsでstringのプレーンエイリアス）
 * 経由で、同じ文字列値のAchievementIdのdefを引く箇所（TitleBadge.tsx・ProfileScreen.tsx、
 * 装備中Titleがsecretかどうかの判定）向けの緩いlookup。ACHIEVEMENT_DEFS_BY_IDを
 * `string`でインデックスすることはTypeScriptの型システム上安全に書けない
 * （約76個のリテラルユニオンをキーに持つRecordへ、プレーンstringでのインデックス
 * アクセスは拒否される）ため、ここに1箇所だけ変換をまとめる。
 */
export function getAchievementDefById(id: string): AchievementDef | undefined {
  return (ACHIEVEMENT_DEFS_BY_ID as Record<string, AchievementDef | undefined>)[id]
}
