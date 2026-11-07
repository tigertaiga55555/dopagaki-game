import { getAchievementCount } from './achievementStorage'
import { getBestPercent, getEndlessBest } from './storage'
import type { PlayerStats } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: PlayerStatsは既存storage
 * （bestPercentV4・EndlessBestV1×3）の値を二重管理せず、その場で組み立てる
 * 読み取り専用のビュー。保存先を増やさないことで「既存ユーザーの記録を失わない」
 * ことを構造的に保証する。
 *
 * worldBattleWins/worldBattleMaxStreakは意図的にフィールド自体を省略する
 * （=undefined）。リアルタイム対戦は未実装のため、偽の0をPlayerStatsにもUIにも
 * 一切持ち込まない。
 */
export interface PlayerStatsRepository {
  getPlayerStats(): PlayerStats
}

export const localPlayerStatsRepository: PlayerStatsRepository = {
  getPlayerStats(): PlayerStats {
    return {
      maxDopaPercent: getBestPercent(),
      endlessBeginnerBest: getEndlessBest('beginner'),
      endlessIntermediateBest: getEndlessBest('intermediate'),
      endlessAdvancedBest: getEndlessBest('advanced'),
      achievementCount: getAchievementCount(),
      // worldBattleWins / worldBattleMaxStreak: 今回は実装しないため省略する。
    }
  },
}
