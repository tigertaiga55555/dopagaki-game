import { describe, expect, it } from 'vitest'
import { buildCreateEndlessChallengeInput } from './endlessChallenge'
import { compareEndlessStreak } from './performance'
import type { EndlessChallengeHostProfile } from './endlessChallenge'

const host: EndlessChallengeHostProfile = {
  playerId: 'pid-host',
  nickname: 'ホスト太郎',
  icon: { kind: 'preset', iconId: 'flame' },
  equippedTitleId: null,
  subTitleIds: [null, null],
  hasPass: false,
}
const problemSet = { version: 1 as const, items: [{ type: 'numberPick', data: { answer: 3 } }] }

describe('buildCreateEndlessChallengeInput (Ver.6 Phase 10: 最低STREAK条件の完全撤廃)', () => {
  it('0 STREAKでも必ずCreateChallengeInputを返す（nullにはならない）', () => {
    for (const difficulty of ['beginner', 'intermediate', 'advanced'] as const) {
      const input = buildCreateEndlessChallengeInput(host, difficulty, 0, problemSet)
      expect(input).not.toBeNull()
      expect(input.creatorScore).toBe(0)
    }
  })

  it('旧来の最低STREAK未満（初級9/中級4/上級2）でも必ず作成できる', () => {
    expect(buildCreateEndlessChallengeInput(host, 'beginner', 9, problemSet).creatorScore).toBe(9)
    expect(buildCreateEndlessChallengeInput(host, 'intermediate', 4, problemSet).creatorScore).toBe(4)
    expect(buildCreateEndlessChallengeInput(host, 'advanced', 2, problemSet).creatorScore).toBe(2)
  })

  it('mode=endless・performance=null・creatorScore=STREAK数のCreateChallengeInputを返す', () => {
    const input = buildCreateEndlessChallengeInput(host, 'advanced', 37, problemSet)
    expect(input).toEqual({
      creatorPlayerId: 'pid-host',
      creatorNickname: 'ホスト太郎',
      creatorIcon: { kind: 'preset', iconId: 'flame' },
      creatorEquippedTitle: null,
      creatorSubTitleIds: [null, null],
      creatorHasPass: false,
      mode: 'endless',
      problemSet,
      conditions: { mode: 'endless', endlessDifficulty: 'advanced' },
      creatorScore: 37,
      performance: null,
    })
  })

  it('creatorSubTitleIds/creatorHasPassはホストプロフィールのスナップショットをそのまま使う（item 157-159）', () => {
    const passHost: EndlessChallengeHostProfile = {
      ...host,
      subTitleIds: ['title-sub1', null],
      hasPass: true,
    }
    const input = buildCreateEndlessChallengeInput(passHost, 'advanced', 10, problemSet)
    expect(input.creatorSubTitleIds).toEqual(['title-sub1', null])
    expect(input.creatorHasPass).toBe(true)
  })

  it('難易度ごとにconditions.endlessDifficultyが正しく設定される', () => {
    const beginnerInput = buildCreateEndlessChallengeInput(host, 'beginner', 0, problemSet)
    expect(beginnerInput.conditions).toEqual({ mode: 'endless', endlessDifficulty: 'beginner' })
  })
})

describe('TARGET 0の正式仕様（Ver.6 Phase 10）: compareEndlessStreakは特別扱いせず既存ルールのまま動く', () => {
  it('ホスト0 STREAK・挑戦者0 STREAK（1問目MISS）→ DRAW', () => {
    expect(compareEndlessStreak(0, 0)).toBe('draw')
  })

  it('ホスト0 STREAK・挑戦者1 STREAK（1問目正解でTARGET超過）→ 即WIN', () => {
    expect(compareEndlessStreak(0, 1)).toBe('win')
  })

  it('TARGET 0専用の別ロジックではなく、通常のTARGET未満=LOSE/同数=DRAW/超過=WINと完全に同じ関数で判定される', () => {
    // 通常のケース（TARGET=5）と全く同じ関数呼び出しであることの確認。
    expect(compareEndlessStreak(5, 4)).toBe('lose')
    expect(compareEndlessStreak(5, 5)).toBe('draw')
    expect(compareEndlessStreak(5, 6)).toBe('win')
  })
})
