import { describe, expect, it } from 'vitest'
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode'

describe('roomCode (Ver.6 Phase 6: フレンド対戦ルームコード)', () => {
  it('6文字のコードを生成する', () => {
    expect(generateRoomCode().length).toBe(6)
  })

  it('見間違えやすい文字（0/O/1/I/L）を含まない', () => {
    const code = generateRoomCode()
    expect(code).not.toMatch(/[0O1IL]/)
  })

  it('生成したコードは常にisValidRoomCodeを満たす', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidRoomCode(generateRoomCode())).toBe(true)
    }
  })

  it('単純な連番ではない（毎回異なるコードが生成される）', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()))
    expect(codes.size).toBeGreaterThan(40)
  })

  it('normalizeRoomCode: 前後の空白を除去し大文字化する', () => {
    expect(normalizeRoomCode(' ab23cd ')).toBe('AB23CD')
  })

  it('isValidRoomCode: 不正な文字を含む・長さが違うコードは拒否する', () => {
    expect(isValidRoomCode('AB23C0')).toBe(false) // '0'は許可アルファベット外
    expect(isValidRoomCode('AB23C')).toBe(false) // 5文字
    expect(isValidRoomCode('AB23CDE')).toBe(false) // 7文字
  })
})
