import { describe, expect, it } from 'vitest'
import { ENDLESS_DIFFICULTIES } from './endlessConfig'
import { ENDLESS_THEME } from './endlessTheme'

describe('endlessTheme (Ver.6 Phase 4.1 color design)', () => {
  it('every difficulty has a theme entry whose id matches its own key', () => {
    for (const d of ENDLESS_DIFFICULTIES) {
      expect(ENDLESS_THEME[d].id).toBe(d)
    }
  })

  it('the 3 difficulties use 3 distinct accent colors (colorRgb)', () => {
    const colors = ENDLESS_DIFFICULTIES.map((d) => ENDLESS_THEME[d].colorRgb)
    expect(new Set(colors).size).toBe(3)
  })

  it('the 3 difficulties use 3 distinct mood labels', () => {
    const moods = ENDLESS_DIFFICULTIES.map((d) => ENDLESS_THEME[d].mood)
    expect(new Set(moods).size).toBe(3)
  })

  it('beginner uses a green/mint family, intermediate blue/cyan, advanced red/orange (per spec)', () => {
    expect(ENDLESS_THEME.beginner.textClass).toContain('emerald')
    expect(ENDLESS_THEME.intermediate.textClass).toContain('cyan')
    expect(ENDLESS_THEME.advanced.textClass).toMatch(/orange|red/)
  })

  it('every theme defines all class fields as non-empty strings (no missing accent piece)', () => {
    for (const d of ENDLESS_DIFFICULTIES) {
      const theme = ENDLESS_THEME[d]
      for (const field of ['textClass', 'cardClass', 'timerBarClass', 'buttonGradientClass', 'buttonShadowClass', 'glowClass'] as const) {
        expect(theme[field].length).toBeGreaterThan(0)
      }
    }
  })
})
