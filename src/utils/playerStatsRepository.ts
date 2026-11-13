import { getAchievementCount } from './achievementStorage'
import { getWorldBattleStats } from './battleStatsStorage'
import { getBestPercent, getEndlessBest } from './storage'
import type { PlayerStats } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: PlayerStatsは既存storage
 * （bestPercentV4・EndlessBestV1×3）の値を二重管理せず、その場で組み立てる
 * 読み取り専用のビュー。保存先を増やさないことで「既存ユーザーの記録を失わない」
 * ことを構造的に保証する。
 *
 * Ver.6 Phase 6（1対1リアルタイム対戦）: worldBattleWins/worldBattleMaxStreakは
 * battleStatsStorage.ts（サーバー確定済みのbattle_finishを受けた直後にだけ更新される
 * ローカルミラー）から読む。
 */
export interface PlayerStatsRepository {
  getPlayerStats(): PlayerStats
}

export const localPlayerStatsRepository: PlayerStatsRepository = {
  getPlayerStats(): PlayerStats {
    const battleStats = getWorldBattleStats()
    return {
      maxDopaPercent: getBestPercent(),
      endlessBeginnerBest: getEndlessBest('beginner'),
      endlessIntermediateBest: getEndlessBest('intermediate'),
      endlessAdvancedBest: getEndlessBest('advanced'),
      achievementCount: getAchievementCount(),
      worldBattleWins: battleStats.wins,
      worldBattleMaxStreak: battleStats.maxStreak,
    }
  },
}
