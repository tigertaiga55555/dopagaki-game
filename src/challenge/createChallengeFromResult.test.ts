import { beforeEach, describe, expect, it } from 'vitest'
import { buildCreateChallengeInput, deriveChallengeMode } from './createChallengeFromResult'
import { getOrCreatePlayerId, updateIcon, updateNickname } from '../utils/profileStorage'
import type { FinalResultV4 } from '../types'

function installFakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  const fake: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  globalThis.localStorage = fake
  return fake
}

function baseResult(overrides: Partial<FinalResultV4> = {}): FinalResultV4 {
  return {
    percent: 87,
    rawPercent: 87,
    overdriveActive: false,
    type: { id: 'test', name: 'テスト' },
    comment: '',
    crimeRecords: [],
    maxCombo: 5,
    fastestReactionMs: 400,
    accuracy: 0.9,
    isFirstPlay: false,
    isNewBest: false,
    bestPercent: 87,
    playCount: 3,
    challengePerformance: { finalDopaPercent: 87, baseDopaPercent: 80, accuracy: 0.9, maxCombo: 5, medianCorrectReactionMs: 400 },
    ...overrides,
  }
}

describe('deriveChallengeMode (Ver.6 Phase 5.2: Challenge機能完成)', () => {
  it('challenge500があればchallenge500', () => {
    expect(deriveChallengeMode(baseResult({ challenge500: { floor: 300, cleared: false } }))).toBe('challenge500')
  })

  it('finalTrialのみあればfinalTrial', () => {
    expect(deriveChallengeMode(baseResult({ finalTrial: { trialsCleared: 10, cleared200: false } }))).toBe('finalTrial')
  })

  it('どちらも無ければnormal', () => {
    expect(deriveChallengeMode(baseResult())).toBe('normal')
  })

  it('challenge500とfinalTrialが両方あればchallenge500を優先する（500%は常に200%到達後にのみ存在しうるため）', () => {
    expect(
      deriveChallengeMode(baseResult({ finalTrial: { trialsCleared: 16, cleared200: true }, challenge500: { floor: 500, cleared: true } })),
    ).toBe('challenge500')
  })
})

describe('buildCreateChallengeInput (Ver.6 Phase 5.2: Profile snapshot)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('recordedProblemSetが無ければnullを返す（挑戦状を送れない）', () => {
    expect(buildCreateChallengeInput(baseResult())).toBeNull()
    expect(buildCreateChallengeInput(baseResult({ recordedProblemSet: [] }))).toBeNull()
  })

  it('Ver.6 Phase 5.3: challengePerformanceが無ければnullを返す（推測値で埋めて送信しない）', () => {
    const result = baseResult({
      recordedProblemSet: [{ type: 'color', targetTimeMs: 900, data: {} }],
      challengePerformance: undefined,
    })
    expect(buildCreateChallengeInput(result)).toBeNull()
  })

  it('Ver.6 Phase 5.3: result.challengePerformanceがそのままCreateChallengeInput.performanceになる', () => {
    const performance = { finalDopaPercent: 95, baseDopaPercent: 85, accuracy: 0.8, maxCombo: 12, medianCorrectReactionMs: 420 }
    const result = baseResult({ recordedProblemSet: [{ type: 'color', targetTimeMs: 900, data: {} }], challengePerformance: performance })
    const input = buildCreateChallengeInput(result)
    expect(input?.performance).toEqual(performance)
  })

  it('現在のProfile（player_id/nickname/avatar/equippedTitleId）をそのままスナップショットする', () => {
    getOrCreatePlayerId()
    updateNickname('テストプレイヤー')
    updateIcon('flame')
    const result = baseResult({ recordedProblemSet: [{ type: 'color', targetTimeMs: 900, data: {} }] })
    const input = buildCreateChallengeInput(result)
    expect(input).not.toBeNull()
    expect(input?.creatorNickname).toBe('テストプレイヤー')
    expect(input?.creatorIcon).toEqual({ kind: 'preset', iconId: 'flame' })
    expect(input?.creatorEquippedTitle).toBeNull()
    expect(input?.creatorPlayerId.length).toBeGreaterThan(0)
  })

  it('problemSetとconditionsとcreatorScoreを正しく組み立てる', () => {
    const items = [
      { type: 'color', targetTimeMs: 900, data: { a: 1 } },
      { type: 'maxNumber', targetTimeMs: 1100, data: { b: 2 } },
    ]
    const result = baseResult({ percent: 95, recordedProblemSet: items })
    const input = buildCreateChallengeInput(result)
    expect(input?.mode).toBe('normal')
    expect(input?.problemSet).toEqual({ version: 1, items })
    expect(input?.conditions).toEqual({ mode: 'normal' })
    expect(input?.creatorScore).toBe(95)
  })
})
