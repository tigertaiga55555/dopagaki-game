import { describe, expect, it } from 'vitest'
import { matchesChallengeModeFilter } from './challengeModeFilter'

describe('matchesChallengeModeFilter (次フェーズ: Challenge一覧ALL/NORMAL/ENDLESSフィルター)', () => {
  it('ALLは常にtrue', () => {
    expect(matchesChallengeModeFilter('normal', 'all')).toBe(true)
    expect(matchesChallengeModeFilter('finalTrial', 'all')).toBe(true)
    expect(matchesChallengeModeFilter('challenge500', 'all')).toBe(true)
    expect(matchesChallengeModeFilter('endless', 'all')).toBe(true)
  })

  it('NORMALはDOPA RUSH系（normal/finalTrial/challenge500）のみtrue、endlessはfalse', () => {
    expect(matchesChallengeModeFilter('normal', 'normal')).toBe(true)
    expect(matchesChallengeModeFilter('finalTrial', 'normal')).toBe(true)
    expect(matchesChallengeModeFilter('challenge500', 'normal')).toBe(true)
    expect(matchesChallengeModeFilter('endless', 'normal')).toBe(false)
  })

  it('ENDLESSはendlessのみtrue', () => {
    expect(matchesChallengeModeFilter('endless', 'endless')).toBe(true)
    expect(matchesChallengeModeFilter('normal', 'endless')).toBe(false)
    expect(matchesChallengeModeFilter('finalTrial', 'endless')).toBe(false)
    expect(matchesChallengeModeFilter('challenge500', 'endless')).toBe(false)
  })
})
