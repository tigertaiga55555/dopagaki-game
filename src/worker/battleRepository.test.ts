import { describe, expect, it } from 'vitest'
import { createD1BattleRepository } from './battleRepository'
import { createBattleFakeD1Database } from './battleTestFakeD1'
import type { ChallengePerformance } from '../challenge/types'

function perf(overrides: Partial<ChallengePerformance> = {}): ChallengePerformance {
  return { finalDopaPercent: 80, baseDopaPercent: 80, accuracy: 0.8, maxCombo: 5, medianCorrectReactionMs: 500, ...overrides }
}

describe('createD1BattleRepository (Ver.6 Phase 6: 世界対戦戦績のD1永続化)', () => {
  it('recordMatch: battle_matchesへ1行INSERTする', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.recordMatch({
      matchId: 'm1',
      mode: 'world',
      player1Id: 'p1',
      player2Id: 'p2',
      player1Performance: perf(),
      player2Performance: perf({ finalDopaPercent: 70 }),
      winner: 'playerA',
      decidedBy: 'finalDopaPercent',
      startedAt: 1000,
      finishedAt: 2000,
      finishReason: 'completed',
    })
    expect(db._matches.length).toBe(1)
  })

  it('applyWorldResult: 初回winで wins=1・currentStreak=1・maxStreak=1', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    const stats = await repo.applyWorldResult('p1', 'win')
    expect(stats).toEqual({ wins: 1, losses: 0, draws: 0, currentStreak: 1, maxStreak: 1 })
  })

  it('applyWorldResult: 連勝が積み重なるとcurrentStreak・maxStreakが伸びる', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.applyWorldResult('p1', 'win')
    await repo.applyWorldResult('p1', 'win')
    const stats = await repo.applyWorldResult('p1', 'win')
    expect(stats).toEqual({ wins: 3, losses: 0, draws: 0, currentStreak: 3, maxStreak: 3 })
  })

  it('applyWorldResult: 敗北でcurrentStreakが0にリセットされるが、maxStreakは維持される', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.applyWorldResult('p1', 'win')
    await repo.applyWorldResult('p1', 'win')
    const stats = await repo.applyWorldResult('p1', 'lose')
    expect(stats).toEqual({ wins: 2, losses: 1, draws: 0, currentStreak: 0, maxStreak: 2 })
  })

  it('applyWorldResult: DRAWはwins変化なし・currentStreak維持', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.applyWorldResult('p1', 'win')
    const stats = await repo.applyWorldResult('p1', 'draw')
    expect(stats).toEqual({ wins: 1, losses: 0, draws: 1, currentStreak: 1, maxStreak: 1 })
  })

  it('getStats: 記録の無いplayerIdはnullを返す（偽の0を返さない）', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    expect(await repo.getStats('never-played')).toBeNull()
  })

  it('getStats: applyWorldResultで保存した内容を取得できる', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.applyWorldResult('p1', 'win')
    expect(await repo.getStats('p1')).toEqual({ wins: 1, losses: 0, draws: 0, currentStreak: 1, maxStreak: 1 })
  })
})
