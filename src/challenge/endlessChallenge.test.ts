import { describe, expect, it } from 'vitest'
import { buildCreateEndlessChallengeInput, ENDLESS_CHALLENGE_MIN_STREAK, meetsEndlessChallengeMinStreak } from './endlessChallenge'
import type { EndlessChallengeHostProfile } from './endlessChallenge'

const host: EndlessChallengeHostProfile = {
  playerId: 'pid-host',
  nickname: 'ホスト太郎',
  icon: { kind: 'preset', iconId: 'flame' },
  equippedTitleId: null,
}
const problemSet = { version: 1 as const, items: [{ type: 'numberPick', data: { answer: 3 } }] }

describe('ENDLESS_CHALLENGE_MIN_STREAK / meetsEndlessChallengeMinStreak (Ver.6 Phase 8)', () => {
  it('初級10・中級5・上級3が最低条件', () => {
    expect(ENDLESS_CHALLENGE_MIN_STREAK).toEqual({ beginner: 10, intermediate: 5, advanced: 3 })
  })

  it('初級: 9はfalse、10はtrue', () => {
    expect(meetsEndlessChallengeMinStreak('beginner', 9)).toBe(false)
    expect(meetsEndlessChallengeMinStreak('beginner', 10)).toBe(true)
  })

  it('中級: 4はfalse、5はtrue', () => {
    expect(meetsEndlessChallengeMinStreak('intermediate', 4)).toBe(false)
    expect(meetsEndlessChallengeMinStreak('intermediate', 5)).toBe(true)
  })

  it('上級: 2はfalse、3はtrue', () => {
    expect(meetsEndlessChallengeMinStreak('advanced', 2)).toBe(false)
    expect(meetsEndlessChallengeMinStreak('advanced', 3)).toBe(true)
  })
})

describe('buildCreateEndlessChallengeInput (Ver.6 Phase 8)', () => {
  it('最低条件未満ならnullを返す（結果画面はこの場合ボタン自体を表示しない）', () => {
    expect(buildCreateEndlessChallengeInput(host, 'advanced', 2, problemSet)).toBeNull()
  })

  it('最低条件以上ならmode=endless・performance=null・creatorScore=STREAK数のCreateChallengeInputを返す', () => {
    const input = buildCreateEndlessChallengeInput(host, 'advanced', 37, problemSet)
    expect(input).toEqual({
      creatorPlayerId: 'pid-host',
      creatorNickname: 'ホスト太郎',
      creatorIcon: { kind: 'preset', iconId: 'flame' },
      creatorEquippedTitle: null,
      mode: 'endless',
      problemSet,
      conditions: { mode: 'endless', endlessDifficulty: 'advanced' },
      creatorScore: 37,
      performance: null,
    })
  })

  it('難易度ごとにconditions.endlessDifficultyが正しく設定される', () => {
    const beginnerInput = buildCreateEndlessChallengeInput(host, 'beginner', 10, problemSet)
    expect(beginnerInput?.conditions).toEqual({ mode: 'endless', endlessDifficulty: 'beginner' })
  })
})
