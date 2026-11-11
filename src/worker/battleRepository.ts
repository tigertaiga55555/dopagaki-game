import type { ChallengePerformance } from '../challenge/types'
import type { BattleDecidedBy, BattleFinishReason, BattleMode, BattleWinner } from '../battle/types'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: battle_matches / player_battle_statsのD1クエリ層。
 * 既存のchallengeRepository.tsと同じ方針（bind()経由のみ、SQL文字列へ値を直接埋め込まない）。
 * リアルタイムの同期自体はDurable Objectのメモリ/ctx.storageだけで行い、D1は正式記録の
 * 永続化にしか使わない（ユーザー指示）。
 */
export interface RecordMatchInput {
  matchId: string
  mode: BattleMode
  player1Id: string
  player2Id: string
  player1Performance: ChallengePerformance
  player2Performance: ChallengePerformance
  winner: BattleWinner
  decidedBy: BattleDecidedBy | null
  startedAt: number
  finishedAt: number
  finishReason: BattleFinishReason
}

export interface BattleStats {
  wins: number
  losses: number
  draws: number
  currentStreak: number
  maxStreak: number
}

export interface BattleRepository {
  recordMatch(input: RecordMatchInput): Promise<void>
  /** 世界対戦のみ呼ぶ（フレンド対戦の結果では呼ばない）。win/lose/drawに応じて勝利数・連勝を更新する。 */
  applyWorldResult(playerId: string, outcome: 'win' | 'lose' | 'draw'): Promise<BattleStats>
  getStats(playerId: string): Promise<BattleStats | null>
}

export function createD1BattleRepository(db: D1Database): BattleRepository {
  return {
    async recordMatch(input) {
      await db
        .prepare(
          `INSERT INTO battle_matches
            (match_id, mode, player1_id, player2_id,
             player1_final_dopa_percent, player1_base_dopa_percent, player1_accuracy, player1_max_combo, player1_median_reaction_ms,
             player2_final_dopa_percent, player2_base_dopa_percent, player2_accuracy, player2_max_combo, player2_median_reaction_ms,
             winner, decided_by, started_at, finished_at, finish_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.matchId,
          input.mode,
          input.player1Id,
          input.player2Id,
          input.player1Performance.finalDopaPercent,
          input.player1Performance.baseDopaPercent,
          input.player1Performance.accuracy,
          input.player1Performance.maxCombo,
          input.player1Performance.medianCorrectReactionMs,
          input.player2Performance.finalDopaPercent,
          input.player2Performance.baseDopaPercent,
          input.player2Performance.accuracy,
          input.player2Performance.maxCombo,
          input.player2Performance.medianCorrectReactionMs,
          input.winner,
          input.decidedBy,
          input.startedAt,
          input.finishedAt,
          input.finishReason,
        )
        .run()
    },

    async applyWorldResult(playerId, outcome) {
      const existing = await db.prepare(`SELECT * FROM player_battle_stats WHERE player_id = ?`).bind(playerId).first<{
        wins: number
        losses: number
        draws: number
        current_streak: number
        max_streak: number
      }>()

      const wins = (existing?.wins ?? 0) + (outcome === 'win' ? 1 : 0)
      const losses = (existing?.losses ?? 0) + (outcome === 'lose' ? 1 : 0)
      const draws = (existing?.draws ?? 0) + (outcome === 'draw' ? 1 : 0)
      // item 26: 勝利→currentStreak+1、敗北→0、DRAW→維持。
      const currentStreak = outcome === 'win' ? (existing?.current_streak ?? 0) + 1 : outcome === 'lose' ? 0 : existing?.current_streak ?? 0
      const maxStreak = Math.max(existing?.max_streak ?? 0, currentStreak)

      await db
        .prepare(
          `INSERT INTO player_battle_stats (player_id, wins, losses, draws, current_streak, max_streak, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(player_id) DO UPDATE SET
             wins = excluded.wins, losses = excluded.losses, draws = excluded.draws,
             current_streak = excluded.current_streak, max_streak = excluded.max_streak, updated_at = excluded.updated_at`,
        )
        .bind(playerId, wins, losses, draws, currentStreak, maxStreak, Date.now())
        .run()

      return { wins, losses, draws, currentStreak, maxStreak }
    },

    async getStats(playerId) {
      const row = await db.prepare(`SELECT * FROM player_battle_stats WHERE player_id = ?`).bind(playerId).first<{
        wins: number
        losses: number
        draws: number
        current_streak: number
        max_streak: number
      }>()
      if (!row) return null
      return { wins: row.wins, losses: row.losses, draws: row.draws, currentStreak: row.current_streak, maxStreak: row.max_streak }
    },
  }
}
