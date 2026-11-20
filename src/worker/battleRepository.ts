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

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 28）: PASS限定の詳細分析画面向け、世界対戦の
 * 平均パフォーマンス＋決着理由別勝利数。既存のplayer_battle_stats（wins/losses/draws等）
 * が持たない「平均DOPA%・平均正答率・平均COMBO・平均反応速度・決着理由別勝数」を、
 * battle_matchesの実データ（migrations/0004で既に保存されている列）から集計する——
 * 推測や新規記録の追加は行わず、既に保存されている値だけを読む。
 */
export interface BattlePerformanceAggregates {
  /** 集計対象の試合数（finishReason==='completed'の世界対戦のみ）。 */
  sampleSize: number
  avgFinalDopaPercent: number
  avgBaseDopaPercent: number
  avgAccuracy: number
  avgMaxCombo: number
  /** 反応速度の母数が1件もない場合はnull。 */
  avgMedianReactionMs: number | null
  /** decidedBy別の勝利数（completedなWINのみ、forfeit/disconnect等のdecidedBy=nullな勝利は含まない）。 */
  winsByDecidedBy: Record<BattleDecidedBy, number>
}

export interface BattleRepository {
  recordMatch(input: RecordMatchInput): Promise<void>
  /** 世界対戦のみ呼ぶ（フレンド対戦の結果では呼ばない）。win/lose/drawに応じて勝利数・連勝を更新する。 */
  applyWorldResult(playerId: string, outcome: 'win' | 'lose' | 'draw'): Promise<BattleStats>
  getPerformanceAggregates(playerId: string): Promise<BattlePerformanceAggregates>
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

    async getPerformanceAggregates(playerId) {
      const { results } = await db
        .prepare(
          `SELECT player1_id, player2_id, winner, decided_by,
             player1_final_dopa_percent, player1_base_dopa_percent, player1_accuracy, player1_max_combo, player1_median_reaction_ms,
             player2_final_dopa_percent, player2_base_dopa_percent, player2_accuracy, player2_max_combo, player2_median_reaction_ms
           FROM battle_matches
           WHERE mode = 'world' AND finish_reason = 'completed' AND (player1_id = ? OR player2_id = ?)
           ORDER BY finished_at DESC
           LIMIT 500`,
        )
        .bind(playerId, playerId)
        .all<{
          player1_id: string
          player2_id: string
          winner: BattleWinner
          decided_by: BattleDecidedBy | null
          player1_final_dopa_percent: number
          player1_base_dopa_percent: number
          player1_accuracy: number
          player1_max_combo: number
          player1_median_reaction_ms: number | null
          player2_final_dopa_percent: number
          player2_base_dopa_percent: number
          player2_accuracy: number
          player2_max_combo: number
          player2_median_reaction_ms: number | null
        }>()

      // legacyScoreOnly/streakはChallenge専用のdecidedBy値で、BattleのcompareDopaPerformanceが
      // 返すことはない（型がChallengeDecidedByを共有しているため完全性のため0で持つだけ）。
      const winsByDecidedBy: Record<BattleDecidedBy, number> = {
        finalDopaPercent: 0,
        baseDopaPercent: 0,
        accuracy: 0,
        maxCombo: 0,
        medianCorrectReactionMs: 0,
        exactTie: 0,
        legacyScoreOnly: 0,
        streak: 0,
      }
      let sumFinal = 0
      let sumBase = 0
      let sumAccuracy = 0
      let sumCombo = 0
      const reactionSamples: number[] = []

      for (const row of results) {
        const isPlayerA = row.player1_id === playerId
        const mySide: BattleWinner = isPlayerA ? 'playerA' : 'playerB'
        sumFinal += isPlayerA ? row.player1_final_dopa_percent : row.player2_final_dopa_percent
        sumBase += isPlayerA ? row.player1_base_dopa_percent : row.player2_base_dopa_percent
        sumAccuracy += isPlayerA ? row.player1_accuracy : row.player2_accuracy
        sumCombo += isPlayerA ? row.player1_max_combo : row.player2_max_combo
        const reaction = isPlayerA ? row.player1_median_reaction_ms : row.player2_median_reaction_ms
        if (reaction !== null) reactionSamples.push(reaction)
        if (row.winner === mySide && row.decided_by) winsByDecidedBy[row.decided_by] += 1
      }

      const sampleSize = results.length
      return {
        sampleSize,
        avgFinalDopaPercent: sampleSize > 0 ? sumFinal / sampleSize : 0,
        avgBaseDopaPercent: sampleSize > 0 ? sumBase / sampleSize : 0,
        avgAccuracy: sampleSize > 0 ? sumAccuracy / sampleSize : 0,
        avgMaxCombo: sampleSize > 0 ? sumCombo / sampleSize : 0,
        avgMedianReactionMs: reactionSamples.length > 0 ? reactionSamples.reduce((a, b) => a + b, 0) / reactionSamples.length : null,
        winsByDecidedBy,
      }
    },
  }
}
