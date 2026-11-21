import { describe, expect, it } from 'vitest'
import { PRE_COUNTDOWN_MS, preCountdownValueAt } from './preCountdown'

describe('preCountdown (Ver.6 Phase 7: 通常モードから抽出した共通カウントダウンロジック)', () => {
  it('at elapsed=0, shows 3', () => {
    expect(preCountdownValueAt(0)).toBe(3)
  })

  it('shows 2 once remaining time drops to 1200ms or below (elapsed=700ms)', () => {
    expect(preCountdownValueAt(700)).toBe(2)
  })

  it('shows 1 once remaining time drops to 600ms or below (elapsed=1300ms)', () => {
    expect(preCountdownValueAt(1300)).toBe(1)
  })

  it('returns null (GO) once PRE_COUNTDOWN_MS has fully elapsed', () => {
    expect(preCountdownValueAt(PRE_COUNTDOWN_MS)).toBeNull()
    expect(preCountdownValueAt(PRE_COUNTDOWN_MS + 500)).toBeNull()
  })

  it('PRE_COUNTDOWN_MS is 1800ms (unchanged from the original useRushGame.ts value)', () => {
    expect(PRE_COUNTDOWN_MS).toBe(1800)
  })
})
