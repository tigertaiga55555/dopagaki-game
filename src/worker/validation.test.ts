import { describe, expect, it } from 'vitest'
import { isValidChallengeId, validateCreateChallengeInput } from './validation'

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
    const items = Array.from({ length: 201 }, (_, i) => ({ type: `q${i}`, data: {} }))
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
