import { describe, expect, it } from 'vitest'
import { HOME_MODES } from './homeConfig'

describe('homeConfig (Ver.6 Phase 7: ホーム画面モード名称・サブコピー最終版)', () => {
  it('shows exactly 3 modes: rush, endless, battle, in this order', () => {
    expect(HOME_MODES.map((m) => m.id)).toEqual(['rush', 'endless', 'battle'])
  })

  it('DOPA RUSH has the correct English title, icon, and sub-copy', () => {
    const rush = HOME_MODES.find((m) => m.id === 'rush')!
    expect(rush.titleEn).toBe('DOPA RUSH')
    expect(rush.icon).toBe('🔥')
    expect(rush.subJa).toBe('0%から500%を目指せ')
  })

  it('ENDLESS has the correct English title, icon, and sub-copy', () => {
    const endless = HOME_MODES.find((m) => m.id === 'endless')!
    expect(endless.titleEn).toBe('ENDLESS')
    expect(endless.icon).toBe('♾️')
    expect(endless.subJa).toBe('1ミスまで、どこまで続けられる？')
  })

  it('ONLINE BATTLE has the correct English title, keeps the sword icon, and the correct sub-copy', () => {
    const battle = HOME_MODES.find((m) => m.id === 'battle')!
    expect(battle.titleEn).toBe('ONLINE BATTLE')
    expect(battle.icon).toBe('⚔️')
    expect(battle.subJa).toBe('世界中のドパガキと1対1')
  })

  it('DOPA RUSH uses a purple/neon-purple gradient (Phase 8: reverted from red per user feedback)', () => {
    const rush = HOME_MODES.find((m) => m.id === 'rush')!
    expect(rush.gradientClass).toMatch(/purple|violet|fuchsia|indigo/)
  })

  it('every mode defines a non-empty gradient and shadow class (brighter/bolder look requirement)', () => {
    for (const mode of HOME_MODES) {
      expect(mode.gradientClass.length).toBeGreaterThan(0)
      expect(mode.shadowClass.length).toBeGreaterThan(0)
    }
  })

  it('the 3 modes use 3 distinct gradient classes (visually distinguishable at a glance)', () => {
    const gradients = HOME_MODES.map((m) => m.gradientClass)
    expect(new Set(gradients).size).toBe(3)
  })
})
