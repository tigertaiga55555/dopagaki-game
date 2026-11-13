import { describe, expect, it } from 'vitest'
import { isValidChallengeId, validateCreateChallengeAttemptInput, validateCreateChallengeInput } from './validation'

function validPerformance() {
  return { finalDopaPercent: 420, baseDopaPercent: 400, accuracy: 0.72, maxCombo: 18, medianCorrectReactionMs: 540 }
}

function validInput() {
  return {
    creatorPlayerId: 'pid-abc123',
    creatorNickname: 'ドパ太郎',
    creatorIcon: { kind: 'preset', iconId: 'flame' },
    creatorEquippedTitle: 'dopa100',
    mode: 'challenge500',
    problemSet: {
      version: 1,
      items: [{ type: 'numberPick', data: { answer: 3 } }],
    },
    conditions: { mode: 'challenge500' },
    creatorScore: 420,
    performance: validPerformance(),
  }
}

describe('validateCreateChallengeInput (Ver.6 Phase 5.1: Challenge作成入力の検証)', () => {
  it('正常な入力はokで通る', () => {
    const result = validateCreateChallengeInput(validInput())
    expect(result.ok).toBe(true)
    expect(result.value?.creatorNickname).toBe('ドパ太郎')
  })

  it('creatorEquippedTitleはnullも許容する（未装備）', () => {
    const result = validateCreateChallengeInput({ ...validInput(), creatorEquippedTitle: null })
    expect(result.ok).toBe(true)
    expect(result.value?.creatorEquippedTitle).toBeNull()
  })

  it('bodyがオブジェクトでなければinvalid', () => {
    expect(validateCreateChallengeInput('not an object').ok).toBe(false)
    expect(validateCreateChallengeInput(null).ok).toBe(false)
    expect(validateCreateChallengeInput(42).ok).toBe(false)
  })

  it('creatorPlayerIdが欠けていればinvalid', () => {
    const { creatorPlayerId, ...rest } = validInput()
    void creatorPlayerId
    expect(validateCreateChallengeInput(rest).ok).toBe(false)
  })

  it('creatorIconが未知のpreset iconIdならinvalid（任意の文字列を信用しない）', () => {
    const result = validateCreateChallengeInput({ ...validInput(), creatorIcon: { kind: 'preset', iconId: 'totally-fake-icon' } })
    expect(result.ok).toBe(false)
  })

  it('creatorIconがremoteCustomでも妥当なurlなら通る（将来のサーバー画像用の型だけ先に許容する）', () => {
    const result = validateCreateChallengeInput({
      ...validInput(),
      creatorIcon: { kind: 'remoteCustom', url: 'https://example.com/avatar.png' },
    })
    expect(result.ok).toBe(true)
  })

  it('modeが未知の値ならinvalid', () => {
    const result = validateCreateChallengeInput({ ...validInput(), mode: 'worldBattle' })
    expect(result.ok).toBe(false)
  })

  it('conditions.modeがトップレベルのmodeと一致しなければinvalid', () => {
    const result = validateCreateChallengeInput({ ...validInput(), mode: 'normal', conditions: { mode: 'challenge500' } })
    expect(result.ok).toBe(false)
  })

  it('problemSet.itemsが空配列ならinvalid（最低1問は必要）', () => {
    const result = validateCreateChallengeInput({ ...validInput(), problemSet: { version: 1, items: [] } })
    expect(result.ok).toBe(false)
  })

  it('problemSet.versionが1以外ならinvalid', () => {
    const result = validateCreateChallengeInput({ ...validInput(), problemSet: { version: 2, items: [{ type: 'x', data: {} }] } })
    expect(result.ok).toBe(false)
  })

  it('problemSetの項目数が上限を超えるとinvalid（D1行の肥大化防止）', () => {
    const items = Array.from({ length: 301 }, (_, i) => ({ type: `q${i}`, data: {} }))
    const result = validateCreateChallengeInput({ ...validInput(), problemSet: { version: 1, items } })
    expect(result.ok).toBe(false)
  })

  it('problemSetの各項目にtypeが無ければinvalid', () => {
    const result = validateCreateChallengeInput({ ...validInput(), problemSet: { version: 1, items: [{ data: {} }] } })
    expect(result.ok).toBe(false)
  })

  it('creatorScoreが非数値・範囲外ならinvalid', () => {
    expect(validateCreateChallengeInput({ ...validInput(), creatorScore: 'not-a-number' }).ok).toBe(false)
    expect(validateCreateChallengeInput({ ...validInput(), creatorScore: -1 }).ok).toBe(false)
    expect(validateCreateChallengeInput({ ...validInput(), creatorScore: Number.POSITIVE_INFINITY }).ok).toBe(false)
  })

  it('creatorNicknameが異常に長い場合はinvalid（クライアント側clampを信用せず、サーバーでも独立して検証する）', () => {
    const result = validateCreateChallengeInput({ ...validInput(), creatorNickname: 'あ'.repeat(1000) })
    expect(result.ok).toBe(false)
  })

  it('Ver.6 Phase 5.3: performanceが欠けていればinvalid', () => {
    const { performance, ...rest } = validInput()
    void performance
    expect(validateCreateChallengeInput(rest).ok).toBe(false)
  })

  it('Ver.6 Phase 5.3: performance.accuracyが0〜1の範囲外ならinvalid', () => {
    expect(validateCreateChallengeInput({ ...validInput(), performance: { ...validPerformance(), accuracy: 1.5 } }).ok).toBe(false)
    expect(validateCreateChallengeInput({ ...validInput(), performance: { ...validPerformance(), accuracy: -0.1 } }).ok).toBe(false)
  })

  it('Ver.6 Phase 5.3: performance.medianCorrectReactionMsはnull、または0以上の有限数のみ許容する', () => {
    expect(validateCreateChallengeInput({ ...validInput(), performance: { ...validPerformance(), medianCorrectReactionMs: null } }).ok).toBe(
      true,
    )
    expect(
      validateCreateChallengeInput({ ...validInput(), performance: { ...validPerformance(), medianCorrectReactionMs: -1 } }).ok,
    ).toBe(false)
  })

  it('Ver.6 Phase 5.3: performance.maxComboが負値ならinvalid', () => {
    expect(validateCreateChallengeInput({ ...validInput(), performance: { ...validPerformance(), maxCombo: -1 } }).ok).toBe(false)
  })
})

describe('validateCreateChallengeAttemptInput (Ver.6 Phase 5.2/5.3: attempt入力の検証)', () => {
  function validAttemptInput() {
    return {
      playerId: 'pid-challenger-1',
      nickname: '挑戦者太郎',
      avatar: { kind: 'preset', iconId: 'star' },
      equippedTitle: null,
      score: 350,
      performance: validPerformance(),
    }
  }

  it('正常な入力はokで通る', () => {
    const result = validateCreateChallengeAttemptInput(validAttemptInput(), 'challenge-1', 'challenge500')
    expect(result.ok).toBe(true)
    expect(result.value?.performance).toEqual(validPerformance())
  })

  it('performanceが欠けていればinvalid（endless以外のmode）', () => {
    const { performance, ...rest } = validAttemptInput()
    void performance
    expect(validateCreateChallengeAttemptInput(rest, 'challenge-1', 'challenge500').ok).toBe(false)
  })

  it('performance.accuracyが範囲外ならinvalid', () => {
    const result = validateCreateChallengeAttemptInput(
      { ...validAttemptInput(), performance: { ...validPerformance(), accuracy: 2 } },
      'challenge-1',
      'challenge500',
    )
    expect(result.ok).toBe(false)
  })

  it('クライアントがresult/decidedByを含めても入力には一切反映されない（そもそも読み取らない）', () => {
    const result = validateCreateChallengeAttemptInput(
      { ...validAttemptInput(), result: 'win', decidedBy: 'maxCombo' },
      'challenge-1',
      'challenge500',
    )
    expect(result.ok).toBe(true)
    expect(result.value).not.toHaveProperty('result')
    expect(result.value).not.toHaveProperty('decidedBy')
  })
})

describe('Ver.6 Phase 8: ENDLESS Challengeの入力検証', () => {
  function validEndlessInput(overrides: Record<string, unknown> = {}) {
    return {
      ...validInput(),
      mode: 'endless',
      conditions: { mode: 'endless', endlessDifficulty: 'advanced' },
      creatorScore: 37,
      performance: null,
      ...overrides,
    }
  }

  it('mode=endlessでperformance=null・十分なSTREAK数ならokで通る（performance検証は一切行わない）', () => {
    const result = validateCreateChallengeInput(validEndlessInput())
    expect(result.ok).toBe(true)
    expect(result.value?.performance).toBeNull()
    expect(result.value?.creatorScore).toBe(37)
  })

  it('初級は10連続未満ならinvalid、10以上ならok', () => {
    const below = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'beginner' }, creatorScore: 9 }),
    )
    expect(below.ok).toBe(false)
    const atMin = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'beginner' }, creatorScore: 10 }),
    )
    expect(atMin.ok).toBe(true)
  })

  it('中級は5連続未満ならinvalid、5以上ならok', () => {
    const below = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'intermediate' }, creatorScore: 4 }),
    )
    expect(below.ok).toBe(false)
    const atMin = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'intermediate' }, creatorScore: 5 }),
    )
    expect(atMin.ok).toBe(true)
  })

  it('上級は3連続未満ならinvalid、3以上ならok', () => {
    const below = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'advanced' }, creatorScore: 2 }),
    )
    expect(below.ok).toBe(false)
    const atMin = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'advanced' }, creatorScore: 3 }),
    )
    expect(atMin.ok).toBe(true)
  })

  it('conditions.endlessDifficultyが不正な値ならinvalid', () => {
    const result = validateCreateChallengeInput(
      validEndlessInput({ conditions: { mode: 'endless', endlessDifficulty: 'legendary' } }),
    )
    expect(result.ok).toBe(false)
  })

  it('creatorScoreが整数でなければinvalid（STREAK数は必ず整数）', () => {
    const result = validateCreateChallengeInput(validEndlessInput({ creatorScore: 37.5 }))
    expect(result.ok).toBe(false)
  })

  it('performanceを渡しても(null以外)invalid', () => {
    const result = validateCreateChallengeInput(validEndlessInput({ performance: validPerformance() }))
    expect(result.ok).toBe(false)
  })

  it('attempt入力: mode=endlessならscore（整数STREAK数）だけでok、performance不要', () => {
    const result = validateCreateChallengeAttemptInput(
      { playerId: 'pid-challenger-1', nickname: '挑戦者太郎', avatar: { kind: 'preset', iconId: 'star' }, equippedTitle: null, score: 38 },
      'challenge-1',
      'endless',
    )
    expect(result.ok).toBe(true)
    expect(result.value?.performance).toBeNull()
    expect(result.value?.score).toBe(38)
  })

  it('attempt入力: mode=endlessでscoreが整数でなければinvalid', () => {
    const result = validateCreateChallengeAttemptInput(
      { playerId: 'pid-challenger-1', nickname: '挑戦者太郎', avatar: { kind: 'preset', iconId: 'star' }, equippedTitle: null, score: 38.5 },
      'challenge-1',
      'endless',
    )
    expect(result.ok).toBe(false)
  })
})

describe('isValidChallengeId', () => {
  it('UUID形式を許可する', () => {
    expect(isValidChallengeId('b2521b49-dae0-4a95-8921-bc79bf5a3861')).toBe(true)
  })

  it('空文字・記号混入・過度に長い値は拒否する', () => {
    expect(isValidChallengeId('')).toBe(false)
    expect(isValidChallengeId('../etc/passwd')).toBe(false)
    expect(isValidChallengeId("1'; DROP TABLE challenges; --")).toBe(false)
    expect(isValidChallengeId('a'.repeat(65))).toBe(false)
  })
})
