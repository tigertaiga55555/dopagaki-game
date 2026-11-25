import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { unlockAchievement } from '../utils/achievementStorage'
import type { TitleRarity } from '../types'

const ACHIEVEMENT_UNLOCKS_KEY = 'dopagaki:achievementUnlocksV1'
const ACHIEVEMENT_SEEN_KEY = 'dopagaki:achievementSeenV1'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 116: リリース前最終デザインラウンド）:
 * Achievement/Title QAパネル専用の直接操作。
 *
 * utils/achievementStorage.ts（本番の公開API）には意図的に「取り消す」操作を一切用意して
 * いない（実績は無料機能であり、一度解除したら二度と失われない、という設計——同ファイルの
 * コメント参照）ため、QA専用のこの別ファイルだけがlocalStorageを直接書き換える。
 *
 * 重要: 単にUI（QAパネルの表示自体）を隠すだけでなく、ここに定義する関数自体の先頭で
 * __DOPAGAKI_PREVIEW_ENABLED__（vite.config.tsのdefineにより、Productionビルドでは
 * 常にリテラルfalseへ静的に置き換わる）を見て即returnする——Productionビルドでは、
 * たとえブラウザの開発者ツール等からこの関数を直接呼び出しても一切何も起きない、
 * という構造的な無効化になる（画面上にQAパネルを出さない、というUIだけの対策とは別の層）。
 */
export function qaUnlockAllAchievements(): void {
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return
  for (const def of ACHIEVEMENT_DEFS) unlockAchievement(def.id)
}

/** 全Achievement/Titleをロック状態へ戻す（解除記録・NEW確認記録の両方を消す）。 */
export function qaLockAllAchievements(): void {
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return
  try {
    localStorage.removeItem(ACHIEVEMENT_UNLOCKS_KEY)
    localStorage.removeItem(ACHIEVEMENT_SEEN_KEY)
  } catch {
    // 失敗しても他の処理には影響させない。
  }
}

export function qaUnlockSecretAchievements(): void {
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.secret) unlockAchievement(def.id)
  }
}

/** SECRETだけを個別にロックへ戻す（それ以外の解除状態は変更しない）。 */
export function qaLockSecretAchievements(): void {
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return
  try {
    const raw = localStorage.getItem(ACHIEVEMENT_UNLOCKS_KEY)
    if (!raw) return
    const map = JSON.parse(raw) as Record<string, number>
    for (const def of ACHIEVEMENT_DEFS) {
      if (def.secret) delete map[def.id]
    }
    localStorage.setItem(ACHIEVEMENT_UNLOCKS_KEY, JSON.stringify(map))
  } catch {
    // 失敗しても他の処理には影響させない。
  }
}

/** 指定したTitleレアリティ（5段階）に該当するAchievementだけを解除する（rarity別絞り込み確認用）。 */
export function qaUnlockAchievementsByRarity(rarity: TitleRarity): void {
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return
  for (const def of ACHIEVEMENT_DEFS) {
    const title = TITLE_DEFS_BY_ID[def.id]
    if (title?.rarity === rarity) unlockAchievement(def.id)
  }
}
