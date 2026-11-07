import { localPlayerStatsRepository, type PlayerStatsRepository } from './playerStatsRepository'
import type { RankingCategoryId } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: Ranking画面がlocalStorageを直接
 * 参照しないようにするための薄いデータソース抽象。
 *
 * 今回はバックエンドを一切導入しないため、オンライン順位データは存在しない
 * （getMyValueは「あなたの記録」だけを返し、順位やランキング全体のリストは一切扱わない。
 * そもそもこのインターフェースに「順位」や「他プレイヤー」を表すフィールドを作らない
 * ことで、架空プレイヤー・ダミー順位を混入させる余地を構造的に無くしている）。
 *
 * 将来Cloudflare/Supabase等のバックエンドを選んだ際は、この1ファイル（または同じ
 * interfaceを実装する新しいクラス）を差し替えるだけでRankingScreen側のコードは
 * 変更不要になる想定。過剰設計を避けるため、今回はinterfaceを1つに留める。
 */
export interface RankingCategoryDef {
  id: RankingCategoryId
  label: string
  unit: string
  /** 今回はまだ対戦を実装していないため準備中として表示するカテゴリ。 */
  comingSoon: boolean
}

export const RANKING_CATEGORIES: RankingCategoryDef[] = [
  { id: 'maxDopaPercent', label: '最高DOPA%', unit: '%', comingSoon: false },
  { id: 'endlessBeginner', label: 'Endless 初級', unit: 'STREAK', comingSoon: false },
  { id: 'endlessIntermediate', label: 'Endless 中級', unit: 'STREAK', comingSoon: false },
  { id: 'endlessAdvanced', label: 'Endless 上級', unit: 'STREAK', comingSoon: false },
  { id: 'worldBattleWins', label: '世界対戦 累計勝利数', unit: '勝', comingSoon: true },
  { id: 'worldBattleMaxStreak', label: '世界対戦 最大連勝', unit: '連勝', comingSoon: true },
]

export interface RankingDataSource {
  /** 指定カテゴリの「あなたの記録」を返す。データがまだ存在しない（comingSoonなカテゴリ等）場合はnull。 */
  getMyValue(category: RankingCategoryId): number | null
}

function createLocalRankingDataSource(statsRepository: PlayerStatsRepository): RankingDataSource {
  return {
    getMyValue(category: RankingCategoryId): number | null {
      const stats = statsRepository.getPlayerStats()
      switch (category) {
        case 'maxDopaPercent':
          return stats.maxDopaPercent
        case 'endlessBeginner':
          return stats.endlessBeginnerBest
        case 'endlessIntermediate':
          return stats.endlessIntermediateBest
        case 'endlessAdvanced':
          return stats.endlessAdvancedBest
        case 'worldBattleWins':
        case 'worldBattleMaxStreak':
          // 世界対戦は未実装。偽の0を返さず、常に「データなし」を表すnullを返す。
          return null
      }
    },
  }
}

export const localRankingDataSource: RankingDataSource = createLocalRankingDataSource(localPlayerStatsRepository)
