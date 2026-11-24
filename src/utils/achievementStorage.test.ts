import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkBattleComebackAchievement,
  checkBattleDecidingStatAchievement,
  checkBattleMirrorAchievement,
  checkChallengeCreatedAchievement,
  checkChallengeDefenseAchievements,
  checkChallengeParticipatedAchievement,
  checkChallengeWantedAchievement,
  checkChallengeWinAchievements,
  checkDopaPercentAchievements,
  checkDopaTypeBandAchievements,
  checkEndlessAchievements,
  checkEndlessChallengeDefenseAchievement,
  checkEndlessChallengeWinAchievement,
  checkFinalQuestionAchievement,
  checkFriendBattleFirstPlayAchievement,
  checkFriendBattlePlayAchievements,
  checkGrindAchievements,
  checkNoMissAchievements,
  checkWorldBattleFirstDrawAchievement,
  checkWorldBattleFirstPlayAchievement,
  checkWorldBattleStreakAchievements,
  checkWorldBattleWinAchievements,
  getAchievementCount,
  getUnseenUnlockedAchievementIds,
  isAchievementUnlocked,
  isTitleUnlocked,
  markAllUnlockedAchievementsSeen,
  unlockAchievement,
} from './achievementStorage'

function installFakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  const fake: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  globalThis.localStorage = fake
  return fake
}

describe('achievementStorage (Ver.6 Phase 5.1: DOPA%実績12個＋Endless実績12個＋490特殊実績)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('100 Achievement解除: 100%到達でdopa50・dopa100が解除される', () => {
    const unlocked = checkDopaPercentAchievements(100)
    expect(unlocked).toEqual(['dopa50', 'dopa100'])
    expect(isAchievementUnlocked('dopa100')).toBe(true)
    expect(isAchievementUnlocked('dopa120')).toBe(false)
  })

  it('120 Achievement解除: 120%到達でdopa50/100/120が解除される', () => {
    const unlocked = checkDopaPercentAchievements(120)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120'])
  })

  it('200 Achievement解除: 200%到達でdopa50/100/120/150/200が解除される', () => {
    const unlocked = checkDopaPercentAchievements(200)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200'])
  })

  it('300 Achievement解除: 300%到達でdopa300までが解除される（250も含む）', () => {
    const unlocked = checkDopaPercentAchievements(300)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200', 'dopa250', 'dopa300'])
  })

  it('400 Achievement解除: 400%到達でdopa400までが解除される（350も含む）', () => {
    const unlocked = checkDopaPercentAchievements(400)
    expect(unlocked).toEqual(['dopa50', 'dopa100', 'dopa120', 'dopa150', 'dopa200', 'dopa250', 'dopa300', 'dopa350', 'dopa400'])
  })

  it('500 Achievement解除: 500%到達でdopaPercent系11実績が解除される（dopa490は含まれない）', () => {
    const unlocked = checkDopaPercentAchievements(500)
    expect(unlocked).toEqual([
      'dopa50',
      'dopa100',
      'dopa120',
      'dopa150',
      'dopa200',
      'dopa250',
      'dopa300',
      'dopa350',
      'dopa400',
      'dopa450',
      'dopa500',
    ])
    expect(isAchievementUnlocked('dopa490')).toBe(false)
    expect(getAchievementCount()).toBe(11)
  })

  it('achievement重複解除防止: 同じ実績を2回解除しようとしても2回目は何も起きない', () => {
    expect(unlockAchievement('dopa100')).toBe(true)
    expect(unlockAchievement('dopa100')).toBe(false)
    expect(getAchievementCount()).toBe(1)
  })

  it('achievement重複解除防止: checkDopaPercentAchievementsを同じ%で2回呼んでも2回目は空配列', () => {
    checkDopaPercentAchievements(500)
    const second = checkDopaPercentAchievements(500)
    expect(second).toEqual([])
    expect(getAchievementCount()).toBe(11)
  })

  it('achievementCount: 解除した分だけ正しくカウントされる', () => {
    expect(getAchievementCount()).toBe(0)
    checkDopaPercentAchievements(250) // dopa50/100/120/150/200/250の6個
    expect(getAchievementCount()).toBe(6)
  })

  it('段階的な到達でも、閾値を跨いだ分だけ新規解除として返る', () => {
    expect(checkDopaPercentAchievements(100)).toEqual(['dopa50', 'dopa100'])
    expect(checkDopaPercentAchievements(150)).toEqual(['dopa120', 'dopa150'])
    expect(checkDopaPercentAchievements(140)).toEqual([]) // 既に120/150は解除済み、140は新しい閾値を跨がない
  })

  it('dopa490（FINAL QUESTION）: reached490=falseでは何も解除しない', () => {
    expect(checkFinalQuestionAchievement(false)).toEqual([])
    expect(isAchievementUnlocked('dopa490')).toBe(false)
  })

  it('dopa490（FINAL QUESTION）: reached490=trueで一度だけ解除される。dopa500とは別実績', () => {
    expect(checkFinalQuestionAchievement(true)).toEqual(['dopa490'])
    expect(isAchievementUnlocked('dopa490')).toBe(true)
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    expect(checkFinalQuestionAchievement(true)).toEqual([]) // 重複解除防止
  })

  it('Endless初級STREAK実績: 閾値10/25/50/100を跨いだ分だけ解除される', () => {
    expect(checkEndlessAchievements('beginner', 10)).toEqual(['endlessBeginner10'])
    expect(checkEndlessAchievements('beginner', 30)).toEqual(['endlessBeginner25'])
    expect(checkEndlessAchievements('beginner', 100)).toEqual(['endlessBeginner50', 'endlessBeginner100'])
  })

  it('Endless中級STREAK実績: 閾値5/15/30/50を跨いだ分だけ解除される', () => {
    expect(checkEndlessAchievements('intermediate', 5)).toEqual(['endlessIntermediate5'])
    expect(checkEndlessAchievements('intermediate', 50)).toEqual(['endlessIntermediate15', 'endlessIntermediate30', 'endlessIntermediate50'])
  })

  it('Endless上級STREAK実績: 閾値3/10/20/30を跨いだ分だけ解除される', () => {
    expect(checkEndlessAchievements('advanced', 3)).toEqual(['endlessAdvanced3'])
    expect(checkEndlessAchievements('advanced', 30)).toEqual(['endlessAdvanced10', 'endlessAdvanced20', 'endlessAdvanced30'])
  })

  it('次フェーズ（実機不具合修正ラウンド）再確認: 初級は9 STREAKでは解除されず、10 STREAKで解除される', () => {
    expect(checkEndlessAchievements('beginner', 9)).toEqual([])
    expect(isAchievementUnlocked('endlessBeginner10')).toBe(false)
    expect(checkEndlessAchievements('beginner', 10)).toEqual(['endlessBeginner10'])
    expect(isAchievementUnlocked('endlessBeginner10')).toBe(true)
  })

  it('次フェーズ（実機不具合修正ラウンド）再確認: 中級は4 STREAKでは解除されず、5 STREAKで解除される', () => {
    expect(checkEndlessAchievements('intermediate', 4)).toEqual([])
    expect(isAchievementUnlocked('endlessIntermediate5')).toBe(false)
    expect(checkEndlessAchievements('intermediate', 5)).toEqual(['endlessIntermediate5'])
    expect(isAchievementUnlocked('endlessIntermediate5')).toBe(true)
  })

  it('次フェーズ（実機不具合修正ラウンド）再確認: 上級は2 STREAKでは解除されず、3 STREAKで解除される', () => {
    expect(checkEndlessAchievements('advanced', 2)).toEqual([])
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(false)
    expect(checkEndlessAchievements('advanced', 3)).toEqual(['endlessAdvanced3'])
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(true)
  })

  it('Endless実績は難易度ごとに独立している（他難易度のstreakに影響しない）', () => {
    checkEndlessAchievements('beginner', 100)
    expect(isAchievementUnlocked('endlessIntermediate5')).toBe(false)
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(false)
  })

  it('Title: 対応するAchievementが解除されるとisTitleUnlockedもtrueになる', () => {
    expect(isTitleUnlocked('dopa100')).toBe(false)
    checkDopaPercentAchievements(100)
    expect(isTitleUnlocked('dopa100')).toBe(true)
  })

  it('Title: Endless実績に対応するTitleもunlockedByAchievementId経由で解除される', () => {
    expect(isTitleUnlocked('endlessAdvanced3')).toBe(false)
    checkEndlessAchievements('advanced', 3)
    expect(isTitleUnlocked('endlessAdvanced3')).toBe(true)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない挑戦者」はwon=falseでは解除されない', () => {
    expect(checkEndlessChallengeWinAchievement(false)).toEqual([])
    expect(isAchievementUnlocked('endlessChallengeFirstWin')).toBe(false)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない挑戦者」はwon=trueで一度だけ解除される。endlessStreak系とは独立している', () => {
    expect(checkEndlessChallengeWinAchievement(true)).toEqual(['endlessChallengeFirstWin'])
    expect(isAchievementUnlocked('endlessChallengeFirstWin')).toBe(true)
    expect(checkEndlessChallengeWinAchievement(true)).toEqual([]) // 重複解除防止
    // 通常ENDLESSの連続正解実績には一切影響しない（別の条件種別のため）。
    expect(isAchievementUnlocked('endlessAdvanced3')).toBe(false)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない門番」はdefended=falseでは解除されない', () => {
    expect(checkEndlessChallengeDefenseAchievement(false)).toEqual([])
    expect(isAchievementUnlocked('endlessChallengeFirstDefense')).toBe(false)
  })

  it('Ver.6 Phase 8: ENDLESS Challenge「終わらない門番」はdefended=trueで一度だけ解除される', () => {
    expect(checkEndlessChallengeDefenseAchievement(true)).toEqual(['endlessChallengeFirstDefense'])
    expect(isAchievementUnlocked('endlessChallengeFirstDefense')).toBe(true)
    expect(checkEndlessChallengeDefenseAchievement(true)).toEqual([]) // 重複解除防止
  })

  it('Ver.6 Phase 8: 通常ENDLESSの連続正解実績を解除しても、ENDLESS Challenge専用の2実績には一切影響しない', () => {
    checkEndlessAchievements('advanced', 30)
    expect(isAchievementUnlocked('endlessChallengeFirstWin')).toBe(false)
    expect(isAchievementUnlocked('endlessChallengeFirstDefense')).toBe(false)
  })
})

describe('Ver.6 Phase 10（実績拡張ラウンド）: DOPA%境界値の再確認', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('DOPA 49%はfalse、50%はtrue', () => {
    expect(checkDopaPercentAchievements(49)).toEqual([])
    expect(isAchievementUnlocked('dopa50')).toBe(false)
    checkDopaPercentAchievements(50)
    expect(isAchievementUnlocked('dopa50')).toBe(true)
  })

  it('DOPA 499%はfalse、500%はtrue', () => {
    checkDopaPercentAchievements(499)
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    checkDopaPercentAchievements(500)
    expect(isAchievementUnlocked('dopa500')).toBe(true)
  })
})

describe('checkNoMissAchievements (Ver.6 Phase 10: ノーミス/完全体)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('正答率100%未満なら、percentがいくつでも解除しない', () => {
    expect(checkNoMissAchievements(500, 0.99)).toEqual([])
    expect(isAchievementUnlocked('noMiss100')).toBe(false)
  })

  it('正答率100%・100%未満のpercentなら解除しない', () => {
    expect(checkNoMissAchievements(99, 1)).toEqual([])
  })

  it('正答率100%・100%以上ならノーミスを解除、200%以上なら完全体も解除', () => {
    expect(checkNoMissAchievements(100, 1)).toEqual(['noMiss100'])
    expect(checkNoMissAchievements(200, 1)).toEqual(['noMiss200'])
  })
})

describe('Challenge系実績 (Ver.6 Phase 10: 作成/参加/勝利ladder/防衛ladder/指名手配)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('checkChallengeCreatedAchievement: 初回のみ解除され、2回目以降は何も起きない', () => {
    expect(checkChallengeCreatedAchievement()).toEqual(['challengeCreatedFirst'])
    expect(checkChallengeCreatedAchievement()).toEqual([])
  })

  it('checkChallengeParticipatedAchievement: 初回のみ解除される', () => {
    expect(checkChallengeParticipatedAchievement()).toEqual(['challengeParticipatedFirst'])
    expect(checkChallengeParticipatedAchievement()).toEqual([])
  })

  it('checkChallengeWinAchievements: 1勝/5勝/20勝/50勝の境界値', () => {
    expect(checkChallengeWinAchievements(0)).toEqual([])
    expect(checkChallengeWinAchievements(1)).toEqual(['challengeWin1'])
    expect(checkChallengeWinAchievements(4)).toEqual([])
    expect(checkChallengeWinAchievements(5)).toEqual(['challengeWin5'])
    expect(checkChallengeWinAchievements(19)).toEqual([])
    expect(checkChallengeWinAchievements(20)).toEqual(['challengeWin20'])
    expect(checkChallengeWinAchievements(49)).toEqual([])
    expect(checkChallengeWinAchievements(50)).toEqual(['challengeWin50'])
  })

  it('checkChallengeDefenseAchievements: 初防衛/10防衛/25防衛の境界値', () => {
    expect(checkChallengeDefenseAchievements(0)).toEqual([])
    expect(checkChallengeDefenseAchievements(1)).toEqual(['challengeDefense1'])
    expect(checkChallengeDefenseAchievements(9)).toEqual([])
    expect(checkChallengeDefenseAchievements(10)).toEqual(['challengeDefense10'])
    expect(checkChallengeDefenseAchievements(24)).toEqual([])
    expect(checkChallengeDefenseAchievements(25)).toEqual(['challengeDefense25'])
  })

  it('checkChallengeWantedAchievement: 9人はfalse（何も解除しない）、10人はtrue（指名手配を解除）', () => {
    expect(checkChallengeWantedAchievement(9)).toEqual([])
    expect(isAchievementUnlocked('challengeWanted10')).toBe(false)
    expect(checkChallengeWantedAchievement(10)).toEqual(['challengeWanted10'])
  })
})

describe('World Battle系実績 (Ver.6 Phase 10)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初プレイ・初DRAWは呼ぶたびに（1回目だけ）解除される', () => {
    expect(checkWorldBattleFirstPlayAchievement()).toEqual(['worldBattleFirstPlay'])
    expect(checkWorldBattleFirstPlayAchievement()).toEqual([])
    expect(checkWorldBattleFirstDrawAchievement()).toEqual(['worldBattleFirstDraw'])
    expect(checkWorldBattleFirstDrawAchievement()).toEqual([])
  })

  it('勝利数ladder: 9勝はfalse、10勝はtrue（1/10/25/50/100/250の境界）', () => {
    expect(checkWorldBattleWinAchievements(9)).toEqual(['worldBattleWin1'])
    expect(isAchievementUnlocked('worldBattleWin10')).toBe(false)
    expect(checkWorldBattleWinAchievements(10)).toEqual(['worldBattleWin10'])
    expect(checkWorldBattleWinAchievements(25)).toEqual(['worldBattleWin25'])
    expect(checkWorldBattleWinAchievements(50)).toEqual(['worldBattleWin50'])
    expect(checkWorldBattleWinAchievements(100)).toEqual(['worldBattleWin100'])
    expect(checkWorldBattleWinAchievements(250)).toEqual(['worldBattleWin250'])
  })

  it('連勝ladder: 3/5/10/20の境界', () => {
    expect(checkWorldBattleStreakAchievements(2)).toEqual([])
    expect(checkWorldBattleStreakAchievements(3)).toEqual(['worldBattleStreak3'])
    expect(checkWorldBattleStreakAchievements(5)).toEqual(['worldBattleStreak5'])
    expect(checkWorldBattleStreakAchievements(10)).toEqual(['worldBattleStreak10'])
    expect(checkWorldBattleStreakAchievements(20)).toEqual(['worldBattleStreak20'])
  })
})

describe('Friend Battle系実績 (Ver.6 Phase 10)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初プレイは1回目だけ解除される', () => {
    expect(checkFriendBattleFirstPlayAchievement()).toEqual(['friendBattleFirstPlay'])
    expect(checkFriendBattleFirstPlayAchievement()).toEqual([])
  })

  it('累計プレイ回数ladder: 10/50/100の境界', () => {
    expect(checkFriendBattlePlayAchievements(9)).toEqual([])
    expect(checkFriendBattlePlayAchievements(10)).toEqual(['friendBattlePlay10'])
    expect(checkFriendBattlePlayAchievements(50)).toEqual(['friendBattlePlay50'])
    expect(checkFriendBattlePlayAchievements(100)).toEqual(['friendBattlePlay100'])
  })

  it('世界対戦の戦績とは完全に独立している', () => {
    checkFriendBattlePlayAchievements(100)
    expect(isAchievementUnlocked('worldBattleWin1')).toBe(false)
    expect(isAchievementUnlocked('worldBattleFirstPlay')).toBe(false)
  })
})

describe('Skill/Special: 世界対戦decidedBy系実績・鏡写し・大逆転 (Ver.6 Phase 10)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('checkBattleDecidingStatAchievement: statごとに対応する実績だけが解除される（取り違えない）', () => {
    expect(checkBattleDecidingStatAchievement('baseDopaPercent')).toEqual(['battleWinByBaseDopa'])
    expect(checkBattleDecidingStatAchievement('accuracy')).toEqual(['battleWinByAccuracy'])
    expect(checkBattleDecidingStatAchievement('maxCombo')).toEqual(['battleWinByMaxCombo'])
    expect(checkBattleDecidingStatAchievement('medianCorrectReactionMs')).toEqual(['battleWinByReaction'])
  })

  it('鏡写し: checkBattleMirrorAchievementを呼んだ場合のみ解除される（exactTie以外では呼び出し側が呼ばない設計）', () => {
    expect(isAchievementUnlocked('battleMirrorMatch')).toBe(false)
    expect(checkBattleMirrorAchievement()).toEqual(['battleMirrorMatch'])
  })

  it('大逆転: checkBattleComebackAchievementを呼んだ場合のみ解除される', () => {
    expect(isAchievementUnlocked('battleComeback')).toBe(false)
    expect(checkBattleComebackAchievement()).toEqual(['battleComeback'])
  })
})

describe('Grind実績 (Ver.6 Phase 10)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('10/50/100/500/1000回の境界', () => {
    expect(checkGrindAchievements(9)).toEqual([])
    expect(checkGrindAchievements(10)).toEqual(['grindPlay10'])
    expect(checkGrindAchievements(50)).toEqual(['grindPlay50'])
    expect(checkGrindAchievements(100)).toEqual(['grindPlay100'])
    expect(checkGrindAchievements(500)).toEqual(['grindPlay500'])
    expect(checkGrindAchievements(1000)).toEqual(['grindPlay1000'])
  })
})

describe('NEW状態の管理 (Ver.6 Phase 10: Achievement画面のNEWバッジ)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('解除済みだが未確認の実績がgetUnseenUnlockedAchievementIdsに含まれる', () => {
    checkDopaPercentAchievements(100)
    const unseen = getUnseenUnlockedAchievementIds()
    expect(unseen.sort()).toEqual(['dopa100', 'dopa50'].sort())
  })

  it('markAllUnlockedAchievementsSeenを呼ぶと、その時点の解除済み実績は全てunseenから消える', () => {
    checkDopaPercentAchievements(100)
    markAllUnlockedAchievementsSeen()
    expect(getUnseenUnlockedAchievementIds()).toEqual([])
  })

  it('markAllUnlockedAchievementsSeenの後に新しく解除された実績だけがunseenに残る', () => {
    checkDopaPercentAchievements(100)
    markAllUnlockedAchievementsSeen()
    checkDopaPercentAchievements(120)
    expect(getUnseenUnlockedAchievementIds()).toEqual(['dopa120'])
  })
})

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 104-109）: DOPA TYPE（帯）実績。
 * checkDopaPercentAchievements（以上なら全部解除の累積判定）とは異なり、実際にその帯の
 * 結果を出した時だけ解除され、高いDOPA%を出したからといって下位TYPEを一括解除しない
 * ——ユーザー指示どおりの判定方式であることをここで直接確認する。
 */
describe('checkDopaTypeBandAchievements（item 104-109: DOPA TYPEは帯だけで判定し、累積解除しない）', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('80-99%帯の結果（92%）を出すと、野生型（dopaTypeWild）だけが解除される——下位帯は解除されない', () => {
    const unlocked = checkDopaTypeBandAchievements(92)
    expect(unlocked).toEqual(['dopaTypeWild'])
    expect(isAchievementUnlocked('dopaTypeWild')).toBe(true)
    expect(isAchievementUnlocked('dopaTypeReason')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeImpatient')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeReflex')).toBe(false)
  })

  it('高いDOPA%（300%）を出しても、下位TYPE（理性残存型等）は一切解除されない', () => {
    checkDopaTypeBandAchievements(300)
    expect(isAchievementUnlocked('dopaTypeLegend')).toBe(true)
    expect(isAchievementUnlocked('dopaTypeReason')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeImpatient')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeReflex')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeWild')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeAwakened')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeAce')).toBe(false)
    expect(isAchievementUnlocked('dopaTypeKing')).toBe(false)
  })

  it('同じ帯に複数回到達しても、2回目以降は新規解除として返らない（重複解除防止）', () => {
    checkDopaTypeBandAchievements(10)
    const second = checkDopaTypeBandAchievements(15)
    expect(second).toEqual([])
  })

  it('500%は既存のdopa500（checkDopaPercentAchievements経由、ドパガキの神に改名済み）で解除され、dopaPercentBand側には500%用の新規実績は存在しない', () => {
    const unlocked = checkDopaTypeBandAchievements(500)
    expect(unlocked).toEqual([])
  })

  it.each([
    [0, 'dopaTypeReason'],
    [24, 'dopaTypeReason'],
    [25, 'dopaTypeImpatient'],
    [49, 'dopaTypeImpatient'],
    [50, 'dopaTypeReflex'],
    [79, 'dopaTypeReflex'],
    [80, 'dopaTypeWild'],
    [99, 'dopaTypeWild'],
    [100, 'dopaTypeAwakened'],
    [199, 'dopaTypeAwakened'],
    [200, 'dopaTypeAce'],
    [299, 'dopaTypeAce'],
    [300, 'dopaTypeLegend'],
    [399, 'dopaTypeLegend'],
    [400, 'dopaTypeKing'],
    [499, 'dopaTypeKing'],
  ])('percent=%i → %sだけが解除される', (percent, expectedId) => {
    const unlocked = checkDopaTypeBandAchievements(percent)
    expect(unlocked).toEqual([expectedId])
  })
})
