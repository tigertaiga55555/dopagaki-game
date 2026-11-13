import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { TITLE_DEFS } from '../config/titles'
import type { AchievementId, EndlessDifficulty, TitleId } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: DOPA%系実績の解除状態の保存。
 *
 * 解除済み実績は { [id]: unlockedAtのミリ秒epoch } という素朴なmapとしてJSONで保存する。
 * 実績は無料機能であり、一度解除したら二度と失われない（このファイルには「取り消す」
 * 操作を一切用意しない）。
 */
const ACHIEVEMENT_UNLOCKS_KEY = 'dopagaki:achievementUnlocksV1'

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
 * 1つの実績を解除する。既に解除済みなら何もせずfalseを返す（重複解除防止）。
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
 * 到達したDOPA%（newPercent）に基づき、まだ解除していないDOPA%実績をすべて解除する。
 * 通常プレイ中の新規到達（resultEngineV4.ts）でも、既存記録からの遡及判定
 * （utils/migrations.ts）でも、この1関数だけを呼べばよい——判定ロジックの二重管理を防ぐ。
 * 新たに解除された実績idの配列を返す（結果画面の通知に使う。何も新規解除がなければ空配列）。
 */
export function checkDopaPercentAchievements(newPercent: number): AchievementId[] {
  const unlocked: AchievementId[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.unlockCondition.type !== 'dopaPercent') continue
    if (newPercent < def.unlockCondition.threshold) continue
    if (unlockAchievement(def.id)) unlocked.push(def.id)
  }
  return unlocked
}

/**
 * 到達したEndless連続正解数（newStreak）に基づき、指定difficultyでまだ解除していない
 * Endless実績をすべて解除する。通常プレイ中の新規到達（useEndlessGame.ts）でも、
 * 既存BESTからの遡及判定（utils/migrations.ts）でも、この1関数だけを呼べばよい。
 */
export function checkEndlessAchievements(difficulty: EndlessDifficulty, newStreak: number): AchievementId[] {
  const unlocked: AchievementId[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.unlockCondition.type !== 'endlessStreak') continue
    if (def.unlockCondition.difficulty !== difficulty) continue
    if (newStreak < def.unlockCondition.threshold) continue
    if (unlockAchievement(def.id)) unlocked.push(def.id)
  }
  return unlocked
}

/**
 * 500%チャレンジでFINAL QUESTION（490%）に到達したときに呼ぶ。bestPercentV4の閾値では
 * 490そのものを表現できないため、Challenge500State.reached490（呼び出し元から渡される）
 * を直接の判定材料にする専用関数（engine/challenge500Engine.ts参照）。
 */
export function checkFinalQuestionAchievement(reached490: boolean): AchievementId[] {
  if (!reached490) return []
  const unlocked: AchievementId[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.unlockCondition.type !== 'challenge500FinalQuestion') continue
    if (unlockAchievement(def.id)) unlocked.push(def.id)
  }
  return unlocked
}

/**
 * Ver.6 Phase 8（ENDLESS Challenge）: 挑戦者としてENDLESS ChallengeにWINしたときに呼ぶ
 * （ChallengeResultScreen.tsxから、mode==='endless'かつattempt.result==='win'の場合のみ）。
 * 通常ENDLESSの連続正解実績（checkEndlessAchievements）とは完全に別の条件種別を見るため、
 * 通常プレイからこの実績が解除されることは構造的にない。
 */
export function checkEndlessChallengeWinAchievement(won: boolean): AchievementId[] {
  if (!won) return []
  const unlocked: AchievementId[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.unlockCondition.type !== 'endlessChallengeWin') continue
    if (unlockAchievement(def.id)) unlocked.push(def.id)
  }
  return unlocked
}

/**
 * Ver.6 Phase 8（ENDLESS Challenge）: ホストとして自分のENDLESS Challengeの防衛
 * （挑戦者がLOSEまたはDRAW＝ホスト視点でWIN）に成功したときに呼ぶ
 * （ChallengeHistoryScreen.tsxから、ホスト本人がmode==='endless'の履歴を開いたときのみ）。
 */
export function checkEndlessChallengeDefenseAchievement(defended: boolean): AchievementId[] {
  if (!defended) return []
  const unlocked: AchievementId[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.unlockCondition.type !== 'endlessChallengeDefense') continue
    if (unlockAchievement(def.id)) unlocked.push(def.id)
  }
  return unlocked
}

export function isTitleUnlocked(titleId: TitleId): boolean {
  const title = TITLE_DEFS.find((t) => t.id === titleId)
  if (!title) return false
  return isAchievementUnlocked(title.unlockedByAchievementId)
}

/** 解除済みのTitleDefだけを返す（Achievement画面・Profile編集の称号選択で使う）。 */
export function getUnlockedTitles() {
  return TITLE_DEFS.filter((t) => isAchievementUnlocked(t.unlockedByAchievementId))
}
