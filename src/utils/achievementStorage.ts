import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { TITLE_DEFS } from '../config/titles'
import type { ChallengeDecidedBy } from '../challenge/types'
import type { AchievementId, AchievementUnlockCondition, EndlessDifficulty, TitleId } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）→Ver.6 Phase 10（実績拡張ラウンド）:
 * 実績の解除状態の保存＋判定。
 *
 * 解除済み実績は { [id]: unlockedAtのミリ秒epoch } という素朴なmapとしてJSONで保存する。
 * 実績は無料機能であり、一度解除したら二度と失われない（このファイルには「取り消す」
 * 操作を一切用意しない）。
 *
 * Ver.6 Phase 10（item 24: 判定を分散させない）: 68個への拡張に伴い、各条件種別ごとに
 * 同じループ＋if＋pushを書いていた旧実装をunlockMatching()へ集約した。新しい実績条件を
 * 追加する際は、types.tsのAchievementUnlockConditionへ型を1つ追加し、
 * config/achievements.tsへAchievementDefを1つ追加し、ここへ対応するcheckXxx関数を
 * 1行（unlockMatching呼び出し）追加するだけでよい——呼び出し元の各画面には判定条件の
 * 詳細を一切持ち込まない（画面はイベントが起きた事実と、必要な数値だけを渡す）。
 */
const ACHIEVEMENT_UNLOCKS_KEY = 'dopagaki:achievementUnlocksV1'
const ACHIEVEMENT_SEEN_KEY = 'dopagaki:achievementSeenV1'

type UnlockMap = Partial<Record<AchievementId, number>>

function readUnlockMap(): UnlockMap {
  try {
    const raw = localStorage.getItem(ACHIEVEMENT_UNLOCKS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as UnlockMap) : {}
  } catch {
    return {}
  }
}

function writeUnlockMap(map: UnlockMap): void {
  try {
    localStorage.setItem(ACHIEVEMENT_UNLOCKS_KEY, JSON.stringify(map))
  } catch {
    // 保存に失敗しても他の処理は継続する。
  }
}

export function getUnlockedAchievements(): UnlockMap {
  return readUnlockMap()
}

export function isAchievementUnlocked(id: AchievementId): boolean {
  return readUnlockMap()[id] !== undefined
}

export function getAchievementCount(): number {
  return Object.keys(readUnlockMap()).length
}

/**
 * 1つの実績を解除する。既に解除済みなら何もせずfalseを返す（重複解除防止・冪等）。
 * 新規解除ならtrueを返す。
 */
export function unlockAchievement(id: AchievementId): boolean {
  const map = readUnlockMap()
  if (map[id] !== undefined) return false
  map[id] = Date.now()
  writeUnlockMap(map)
  return true
}

/**
 * ACHIEVEMENT_DEFS全体を1回だけ走査し、predicateがtrueを返した定義だけを解除する共通ヘルパー。
 * 既に解除済みのものはunlockAchievement自体が無視する（重複解除防止はここでも効く）。
 */
function unlockMatching(predicate: (condition: AchievementUnlockCondition) => boolean): AchievementId[] {
  const unlocked: AchievementId[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (!predicate(def.unlockCondition)) continue
    if (unlockAchievement(def.id)) unlocked.push(def.id)
  }
  return unlocked
}

/**
 * 到達したDOPA%（newPercent）に基づき、まだ解除していないDOPA%実績をすべて解除する。
 * 公式プレイ（resultEngineV4.tsのofficial=trueの経路）からのみ呼ばれる。
 */
export function checkDopaPercentAchievements(newPercent: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'dopaPercent' && newPercent >= c.threshold)
}

/**
 * 次フェーズ（item 104-109）: DOPA TYPE（config/dopaType.tsの単一定義）の帯に実際に
 * その結果が収まった場合だけ解除する——checkDopaPercentAchievements（以上なら全部解除の
 * 累積判定）とは異なり、高いDOPA%を出したからといって下位TYPEを一括解除しない。
 * 呼び出し元（resultEngineV4.ts）はcheckDopaPercentAchievementsと同じ3箇所から
 * 同じfinalPercentで呼ぶ。
 */
export function checkDopaTypeBandAchievements(newPercent: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'dopaPercentBand' && newPercent >= c.min && newPercent <= c.max)
}

/** 到達したEndless連続正解数（newStreak）に基づき、指定difficultyの実績をすべて解除する。 */
export function checkEndlessAchievements(difficulty: EndlessDifficulty, newStreak: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'endlessStreak' && c.difficulty === difficulty && newStreak >= c.threshold)
}

/**
 * 次フェーズ（item 137-140、大型最終仕上げラウンド）: 旧checkFinalQuestionAchievement
 * （490%到達だけで解除、dopa490「最後の一問」用）は削除した。代わりに、490%（FINAL
 * QUESTION）に到達しながら不正解に終わり500%到達を逃した場合だけ解除する
 * （呼び出し元のengine/resultEngineV4.tsがstate.reached490 && state.ended && !state.cleared
 * を渡す。SECRET「全部水の泡」用）。
 */
export function checkChallenge500MissedFinalAchievement(missedFinal: boolean): AchievementId[] {
  if (!missedFinal) return []
  return unlockMatching((c) => c.type === 'challenge500MissedFinal')
}

/** Ver.6 Phase 10: 公式DOPA RUSHプレイでpercent%以上・正答率100%だったときに呼ぶ（ノーミス/完全体）。 */
export function checkNoMissAchievements(percent: number, accuracy: number): AchievementId[] {
  if (accuracy < 1) return []
  return unlockMatching((c) => c.type === 'noMiss' && percent >= c.threshold)
}

// --- Challenge（通常Challenge・ENDLESS Challenge共通のladder） ---

export function checkEndlessChallengeWinAchievement(won: boolean): AchievementId[] {
  if (!won) return []
  return unlockMatching((c) => c.type === 'endlessChallengeWin')
}

export function checkEndlessChallengeDefenseAchievement(defended: boolean): AchievementId[] {
  if (!defended) return []
  return unlockMatching((c) => c.type === 'endlessChallengeDefense')
}

/** Ver.6 Phase 10: Challengeを初めて作成した（通常・ENDLESS問わず）。 */
export function checkChallengeCreatedAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'challengeCreated')
}

/** Ver.6 Phase 10: Challengeに初めて挑戦者として参加した（通常・ENDLESS問わず）。 */
export function checkChallengeParticipatedAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'challengeParticipated')
}

/** Ver.6 Phase 10: 挑戦者としての累計勝利数（通常Challenge＋ENDLESS Challenge合算）。 */
export function checkChallengeWinAchievements(totalWinCount: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'challengeWinCount' && totalWinCount >= c.threshold)
}

/** Ver.6 Phase 10: 作成者としての累計防衛数（通常Challenge＋ENDLESS Challenge合算、DRAWは含まない）。 */
export function checkChallengeDefenseAchievements(totalDefenseCount: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'challengeDefenseCount' && totalDefenseCount >= c.threshold)
}

/** Ver.6 Phase 10: 自分の1つのChallengeに10人以上の異なる挑戦者が挑んだ（指名手配）。 */
export function checkChallengeWantedAchievement(distinctChallengerCount: number): AchievementId[] {
  if (distinctChallengerCount < 10) return []
  return unlockMatching((c) => c.type === 'challengeWanted')
}

// --- World Battle ---

export function checkWorldBattleFirstPlayAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'worldBattleFirstPlay')
}

export function checkWorldBattleWinAchievements(totalWins: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'worldBattleWinCount' && totalWins >= c.threshold)
}

export function checkWorldBattleStreakAchievements(maxStreak: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'worldBattleStreak' && maxStreak >= c.threshold)
}

export function checkWorldBattleFirstDrawAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'worldBattleFirstDraw')
}

// --- Friend Battle ---

export function checkFriendBattleFirstPlayAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'friendBattleFirstPlay')
}

export function checkFriendBattlePlayAchievements(totalPlays: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'friendBattlePlayCount' && totalPlays >= c.threshold)
}

// --- Skill / Special（世界対戦のdecidedBy由来） ---

/**
 * Ver.6 Phase 10: 世界対戦で勝利し、かつその勝敗を決めた項目（decidedBy）がbaseDopaPercent/
 * accuracy/maxCombo/medianCorrectReactionMsのいずれかだった場合に呼ぶ。finalDopaPercent/
 * exactTie/legacyScoreOnly/streak（Battleでは発生しない）で決着した場合はこの関数自体を
 * 呼び出し側（BattleResultScreen.tsx）が呼ばない——「実際にその項目まで比較が進み、
 * その項目が決勝要因になった場合のみ」というユーザー指示を、呼び出し条件として表現する。
 */
export function checkBattleDecidingStatAchievement(
  stat: Exclude<ChallengeDecidedBy, 'finalDopaPercent' | 'exactTie' | 'legacyScoreOnly' | 'streak'>,
): AchievementId[] {
  return unlockMatching((c) => c.type === 'battleDecidingStat' && c.stat === stat)
}

/** Ver.6 Phase 10: 世界対戦で5項目完全一致のDRAW（decidedBy==='exactTie'）になった場合に呼ぶ。 */
export function checkBattleMirrorAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'battleMirror')
}

/** Ver.6 Phase 10: 世界対戦で大差のビハインドから逆転勝利した場合に呼ぶ。 */
export function checkBattleComebackAchievement(): AchievementId[] {
  return unlockMatching((c) => c.type === 'battleComeback')
}

// --- Grind ---

/** Ver.6 Phase 10: 公式プレイ（DOPA RUSH/ENDLESS/世界対戦/フレンド対戦）の累計回数。 */
export function checkGrindAchievements(officialPlayCount: number): AchievementId[] {
  return unlockMatching((c) => c.type === 'officialPlayCount' && officialPlayCount >= c.threshold)
}

// --- SECRET（item 137-141、大型最終仕上げラウンド） ---

/** ENDLESS初級150・中級100・上級50の自己ベストを3つとも同時に満たしている場合に呼ぶ（SECRET「三冠王」）。 */
export function checkEndlessTripleCrownAchievement(beginnerBest: number, intermediateBest: number, advancedBest: number): AchievementId[] {
  if (beginnerBest < 150 || intermediateBest < 100 || advancedBest < 50) return []
  return unlockMatching((c) => c.type === 'endlessTripleCrown')
}

/**
 * ENDLESS Challengeで、creatorScore===0の挑戦状を作成し、かつ挑戦者側も0 STREAKで終えた
 * 相手を防衛（ホスト視点でWIN）した場合に呼ぶ（SECRET「0の壁」）。呼び出し元
 * （ChallengeHistoryScreen.tsx）が、このChallenge自体がcreatorScore===0・mode==='endless'
 * であること、かつ少なくとも1つのattemptがscore===0・ホスト視点winであることを
 * 確認してから呼ぶ。
 */
export function checkChallengeZeroWallAchievement(qualifies: boolean): AchievementId[] {
  if (!qualifies) return []
  return unlockMatching((c) => c.type === 'challengeZeroStreakDefense')
}

/**
 * DOPA RUSH系Challengeで、相手（作成者）の基準記録が500%だった挑戦状へ挑戦し、最終的に
 * WINした場合に呼ぶ（SECRET「神越え」）。呼び出し元（ChallengeResultScreen.tsx）が
 * challenge.creatorScore===500・challenge.mode!=='endless'・result==='win'を確認してから呼ぶ。
 */
export function checkChallengeBeatGodAchievement(qualifies: boolean): AchievementId[] {
  if (!qualifies) return []
  return unlockMatching((c) => c.type === 'challengeBeat500')
}

/**
 * 自分が作成した同一Challengeに、異なる10人以上の挑戦者が挑み、かつその全員から防衛
 * できている（誰にも突破されていない）場合に呼ぶ（SECRET「ラスボス」）。呼び出し元
 * （SentChallengesScreen.tsx）が、1つのChallengeSummaryについてchallengerCount>=10・
 * clearedCount===0を確認してから呼ぶ（複数Challengeの合算ではなく、1つで条件を
 * 満たす必要がある——既存の「指名手配」と同じ単位の考え方）。
 */
export function checkChallengeLastBossAchievement(qualifies: boolean): AchievementId[] {
  if (!qualifies) return []
  return unlockMatching((c) => c.type === 'challengeUndefeated10')
}

/**
 * PRIVATE ROOMが8/8満員、かつ4TABLEすべてが同時に対戦進行中の状態が成立した場合に呼ぶ
 * （SECRET「ドパガキ大集合」）。呼び出し元（PrivateRoomLobbyScreen.tsx）がroom_state更新の
 * たびにmembers.length===8 && tables.every(t=>t.activeMatch!==null)を確認してから呼ぶ。
 */
export function checkFriendRoomFullHouseAchievement(qualifies: boolean): AchievementId[] {
  if (!qualifies) return []
  return unlockMatching((c) => c.type === 'friendRoomAllTablesActive')
}

/**
 * 同一PRIVATE ROOM内で、自分以外の7人全員に最低1回ずつ勝利した場合に呼ぶ
 * （SECRET「フレネミー」）。呼び出し元（PrivateRoomLobbyScreen.tsx）がroomState.matchHistory
 * から自分の勝利を集計し、現在の他メンバー全員（7人）を打ち負かしたことを確認してから呼ぶ。
 */
export function checkFriendRoomFrenemyAchievement(qualifies: boolean): AchievementId[] {
  if (!qualifies) return []
  return unlockMatching((c) => c.type === 'friendRoomBeatAllMembers')
}

// --- Title ---

export function isTitleUnlocked(titleId: TitleId): boolean {
  const title = TITLE_DEFS.find((t) => t.id === titleId)
  if (!title) return false
  return isAchievementUnlocked(title.unlockedByAchievementId)
}

/** 解除済みのTitleDefだけを返す（Achievement画面・Profile編集の称号選択で使う）。 */
export function getUnlockedTitles() {
  return TITLE_DEFS.filter((t) => isAchievementUnlocked(t.unlockedByAchievementId))
}

// --- NEW状態（Ver.6 Phase 10: Achievement画面のNEWバッジ管理） ---

function readSeenSet(): Set<AchievementId> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENT_SEEN_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed as AchievementId[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeSeenSet(seen: Set<AchievementId>): void {
  try {
    localStorage.setItem(ACHIEVEMENT_SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    // 保存に失敗してもNEWバッジが消えないだけで、他機能には影響しない。
  }
}

/** 解除済みだが、まだAchievement画面で一度も確認されていない実績idの一覧（NEWバッジ表示用）。 */
export function getUnseenUnlockedAchievementIds(): AchievementId[] {
  const unlocked = Object.keys(readUnlockMap()) as AchievementId[]
  const seen = readSeenSet()
  return unlocked.filter((id) => !seen.has(id))
}

/**
 * 現在解除済みの実績を全て「確認済み」にする。AchievementScreen.tsxがマウント時に
 * （NEWバッジとして見せる一覧を先に取得した直後に）1回だけ呼ぶ想定——次回以降の訪問では
 * 同じ実績にNEWが付かなくなる。
 */
export function markAllUnlockedAchievementsSeen(): void {
  const unlocked = Object.keys(readUnlockMap()) as AchievementId[]
  writeSeenSet(new Set(unlocked))
}
