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

describe('createD1BattleRepository.getPerformanceAggregates (次フェーズ、DOPA PASS基盤ラウンド item 28)', () => {
  it('記録が無ければsampleSize=0・平均値は0・反応速度はnull', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    const value = await repo.getPerformanceAggregates('never-played')
    expect(value.sampleSize).toBe(0)
    expect(value.avgFinalDopaPercent).toBe(0)
    expect(value.avgMedianReactionMs).toBeNull()
  })

  it('player1側の試合を自分視点で正しく集計する', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.recordMatch({
      matchId: 'm1',
      mode: 'world',
      player1Id: 'p1',
      player2Id: 'p2',
      player1Performance: perf({ finalDopaPercent: 100, accuracy: 0.9, maxCombo: 10, medianCorrectReactionMs: 400 }),
      player2Performance: perf({ finalDopaPercent: 80 }),
      winner: 'playerA',
      decidedBy: 'finalDopaPercent',
      startedAt: 1000,
      finishedAt: 2000,
      finishReason: 'completed',
    })
    const value = await repo.getPerformanceAggregates('p1')
    expect(value.sampleSize).toBe(1)
    expect(value.avgFinalDopaPercent).toBe(100)
    expect(value.avgAccuracy).toBe(0.9)
    expect(value.avgMaxCombo).toBe(10)
    expect(value.avgMedianReactionMs).toBe(400)
    expect(value.winsByDecidedBy.finalDopaPercent).toBe(1)
  })

  it('player2側の試合でも自分視点（player2の列）で正しく集計する', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.recordMatch({
      matchId: 'm1',
      mode: 'world',
      player1Id: 'p1',
      player2Id: 'p2',
      player1Performance: perf({ finalDopaPercent: 60 }),
      player2Performance: perf({ finalDopaPercent: 90, maxCombo: 7 }),
      winner: 'playerB',
      decidedBy: 'maxCombo',
      startedAt: 1000,
      finishedAt: 2000,
      finishReason: 'completed',
    })
    const value = await repo.getPerformanceAggregates('p2')
    expect(value.avgFinalDopaPercent).toBe(90)
    expect(value.avgMaxCombo).toBe(7)
    expect(value.winsByDecidedBy.maxCombo).toBe(1)
  })

  it('finish_reasonがcompleted以外（forfeit等）の試合は集計対象外', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.recordMatch({
      matchId: 'm1',
      mode: 'world',
      player1Id: 'p1',
      player2Id: 'p2',
      player1Performance: perf(),
      player2Performance: perf(),
      winner: 'playerA',
      decidedBy: null,
      startedAt: 1000,
      finishedAt: 2000,
      finishReason: 'forfeit',
    })
    const value = await repo.getPerformanceAggregates('p1')
    expect(value.sampleSize).toBe(0)
  })

  it('mode=friendの試合は集計対象外（世界対戦のみ）', async () => {
    const db = createBattleFakeD1Database()
    const repo = createD1BattleRepository(db as never)
    await repo.recordMatch({
      matchId: 'm1',
      mode: 'friend',
      player1Id: 'p1',
      player2Id: 'p2',
      player1Performance: perf(),
      player2Performance: perf(),
      winner: 'playerA',
      decidedBy: 'finalDopaPercent',
      startedAt: 1000,
      finishedAt: 2000,
      finishReason: 'completed',
    })
    const value = await repo.getPerformanceAggregates('p1')
    expect(value.sampleSize).toBe(0)
  })
})
