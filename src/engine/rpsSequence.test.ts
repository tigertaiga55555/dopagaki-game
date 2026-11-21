import { describe, expect, it } from 'vitest'
import {
  generateRpsHandSequence,
  RPS_BLANK_MS,
  RPS_HAND_IDS,
  RPS_HAND_STEP_MS,
  rpsRevealPhaseAt,
  rpsSequenceRevealTotalMs,
} from './rpsSequence'

const DRAWS = 500

describe('generateRpsHandSequence (Ver.6 Phase 9: じゃんけん連続提示の隣接重複禁止)', () => {
  it('隣り合う手は絶対に同じにならない（3手・4手・5手、500回抽選）', () => {
    for (const length of [3, 4, 5]) {
      for (let i = 0; i < DRAWS; i++) {
        const sequence = generateRpsHandSequence(length)
        expect(sequence).toHaveLength(length)
        for (let j = 1; j < sequence.length; j++) {
          expect(sequence[j]).not.toBe(sequence[j - 1])
        }
        for (const hand of sequence) {
          expect(RPS_HAND_IDS).toContain(hand)
        }
      }
    }
  })

  it('1個飛ばし（hand[0]とhand[2]）が同じになることは禁止しない（500回抽選中に実際に発生する）', () => {
    let sawRepeatAtDistance2 = false
    for (let i = 0; i < DRAWS; i++) {
      const sequence = generateRpsHandSequence(3)
      if (sequence[0] === sequence[2]) {
        sawRepeatAtDistance2 = true
        break
      }
    }
    expect(sawRepeatAtDistance2).toBe(true)
  })

  it('length=1の場合は1手だけ返す（隣接比較自体が発生しない）', () => {
    const sequence = generateRpsHandSequence(1)
    expect(sequence).toHaveLength(1)
  })
})

describe('rpsRevealPhaseAt (Ver.6 Phase 9: 表示→消去→blank→次の表示の純粋タイムライン計算)', () => {
  const length = 3

  it('1手目の表示中（0〜handMs）はshowing index=0', () => {
    expect(rpsRevealPhaseAt(0, length)).toEqual({ kind: 'showing', index: 0 })
    expect(rpsRevealPhaseAt(RPS_HAND_STEP_MS - 1, length)).toEqual({ kind: 'showing', index: 0 })
  })

  it('1手目の消去直後〜2手目表示開始前はblank', () => {
    expect(rpsRevealPhaseAt(RPS_HAND_STEP_MS, length)).toEqual({ kind: 'blank' })
    expect(rpsRevealPhaseAt(RPS_HAND_STEP_MS + RPS_BLANK_MS - 1, length)).toEqual({ kind: 'blank' })
  })

  it('2手目の表示中はshowing index=1', () => {
    const stepMs = RPS_HAND_STEP_MS + RPS_BLANK_MS
    expect(rpsRevealPhaseAt(stepMs, length)).toEqual({ kind: 'showing', index: 1 })
  })

  it('3手目の表示後、最後のblankを経てdoneになる（回答フェーズはこの後にしか始まらない）', () => {
    const total = rpsSequenceRevealTotalMs(length)
    expect(rpsRevealPhaseAt(total - 1, length).kind).toBe('blank')
    expect(rpsRevealPhaseAt(total, length)).toEqual({ kind: 'done' })
    expect(rpsRevealPhaseAt(total + 10000, length)).toEqual({ kind: 'done' })
  })

  it('4手版（ULTIMATE QUESTION）でも同じ規則で動く', () => {
    const total4 = rpsSequenceRevealTotalMs(4)
    expect(rpsRevealPhaseAt(0, 4)).toEqual({ kind: 'showing', index: 0 })
    expect(rpsRevealPhaseAt(total4, 4)).toEqual({ kind: 'done' })
  })

  it('handMs/blankMsを明示的に変えても一貫して計算できる', () => {
    expect(rpsRevealPhaseAt(0, 2, 100, 50)).toEqual({ kind: 'showing', index: 0 })
    expect(rpsRevealPhaseAt(100, 2, 100, 50)).toEqual({ kind: 'blank' })
    expect(rpsRevealPhaseAt(150, 2, 100, 50)).toEqual({ kind: 'showing', index: 1 })
    expect(rpsRevealPhaseAt(300, 2, 100, 50)).toEqual({ kind: 'done' })
  })
})

describe('rpsSequenceRevealTotalMs', () => {
  it('length * (handMs + blankMs) を返す', () => {
    expect(rpsSequenceRevealTotalMs(3)).toBe(3 * (RPS_HAND_STEP_MS + RPS_BLANK_MS))
    expect(rpsSequenceRevealTotalMs(4)).toBe(4 * (RPS_HAND_STEP_MS + RPS_BLANK_MS))
  })
})
