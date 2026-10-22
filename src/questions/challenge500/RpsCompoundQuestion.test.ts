import { describe, expect, it } from 'vitest'
import { opposite } from '../../engine/inversion/words'
import { RpsCompoundChallenge500Module } from './RpsCompoundQuestion'
import type { PromptSegment } from '../../components/InversionPrompt'

type Hand = 'rock' | 'paper' | 'scissors'
interface Panel {
  id: number
  opponent: Hand
  winLoseWordShown: string
  inverted: boolean
}
type Data = {
  panels: Panel[]
  correctHandByPanel: Record<number, Hand>
  segmentsByPanel: Record<number, PromptSegment[]>
}

const RUNS = 600

function winningHandAgainst(hand: Hand): Hand {
  if (hand === 'rock') return 'paper'
  if (hand === 'paper') return 'scissors'
  return 'rock'
}
function losingHandAgainst(hand: Hand): Hand {
  if (hand === 'rock') return 'scissors'
  if (hand === 'paper') return 'rock'
  return 'paper'
}

function expectedHandFor(panel: Panel): Hand {
  const effective = panel.inverted ? opposite('winLose', panel.winLoseWordShown) : panel.winLoseWordShown
  return effective === '勝つ' ? winningHandAgainst(panel.opponent) : losingHandAgainst(panel.opponent)
}

describe('RpsCompoundQuestion (winLose-axis RPS inversion template, FINAL/ULTIMATE-derived)', () => {
  it('tier1: exactly 1 panel; correct hand independently re-derived matches generator output; never the tie hand', () => {
    const seenInverted = new Set<boolean>()
    for (let i = 0; i < RUNS; i++) {
      const data = RpsCompoundChallenge500Module.generate(1) as Data
      expect(data.panels).toHaveLength(1)
      const panel = data.panels[0]
      seenInverted.add(panel.inverted)

      const expected = expectedHandFor(panel)
      expect(data.correctHandByPanel[panel.id]).toBe(expected)
      expect(expected).not.toBe(panel.opponent) // あいこの手は絶対に正解になり得ない
    }
    expect(seenInverted.has(true)).toBe(true)
    expect(seenInverted.has(false)).toBe(true)
  })

  it('tier2/tier3: exactly 2 independent panels; each independently re-derived correct hand matches; 0/1/2 inversions all occur', () => {
    for (const tier of [2, 3] as const) {
      const seenInvertCounts = new Set<number>()
      for (let i = 0; i < RUNS; i++) {
        const data = RpsCompoundChallenge500Module.generate(tier) as Data
        expect(data.panels).toHaveLength(2)
        const invertCount = data.panels.filter((p) => p.inverted).length
        seenInvertCounts.add(invertCount)

        for (const panel of data.panels) {
          const expected = expectedHandFor(panel)
          expect(data.correctHandByPanel[panel.id]).toBe(expected)
          expect(expected).not.toBe(panel.opponent)
        }
      }
      expect(seenInvertCounts.has(0)).toBe(true)
      expect(seenInvertCounts.has(1)).toBe(true)
      expect(seenInvertCounts.has(2)).toBe(true)
    }
  })

  it('every panel has a segmentsByPanel entry describing its own opponent and instruction', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let i = 0; i < 50; i++) {
        const data = RpsCompoundChallenge500Module.generate(tier) as Data
        for (const panel of data.panels) {
          expect(data.segmentsByPanel[panel.id]).toBeDefined()
          expect(data.segmentsByPanel[panel.id].some((s) => s.inverted === panel.inverted)).toBe(true)
        }
      }
    }
  })
})
