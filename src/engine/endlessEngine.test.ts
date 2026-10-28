import { describe, expect, it } from 'vitest'
import { applyEndlessCorrect, applyEndlessMiss, createEndlessState } from './endlessEngine'

describe('endlessEngine', () => {
  it('starts at streak 0, not ended', () => {
    const state = createEndlessState()
    expect(state.streak).toBe(0)
    expect(state.ended).toBe(false)
  })

  it('correct answer increments streak by exactly 1 (score increment)', () => {
    let state = createEndlessState()
    state = applyEndlessCorrect(state)
    expect(state.streak).toBe(1)
    state = applyEndlessCorrect(state)
    expect(state.streak).toBe(2)
    state = applyEndlessCorrect(state)
    expect(state.streak).toBe(3)
  })

  it('MISS ends immediately and keeps the streak value reached so far (verbatim example: 12 correct -> MISS -> SCORE 12)', () => {
    let state = createEndlessState()
    for (let i = 0; i < 12; i++) state = applyEndlessCorrect(state)
    expect(state.streak).toBe(12)
    expect(state.ended).toBe(false)
    state = applyEndlessMiss(state)
    expect(state.ended).toBe(true)
    expect(state.streak).toBe(12)
  })

  it('a MISS on the very first question ends with score 0', () => {
    const state = applyEndlessMiss(createEndlessState())
    expect(state.ended).toBe(true)
    expect(state.streak).toBe(0)
  })

  it('timeout is treated identically to any other MISS (same function, no special-casing)', () => {
    // Endlessのtimeoutは「各問題コンポーネント自身がcorrect:falseを返す」だけで、
    // エンジン側には区別する概念が存在しない。applyEndlessMiss自体がtimeout専用の
    // 分岐を持たないことを確認する（=timeoutも通常のMISSと完全に同じ経路で終了する）。
    let state = createEndlessState()
    for (let i = 0; i < 5; i++) state = applyEndlessCorrect(state)
    const afterTimeout = applyEndlessMiss(state)
    const afterWrongAnswer = applyEndlessMiss(state)
    expect(afterTimeout).toEqual(afterWrongAnswer)
  })

  it('once ended, further correct/miss calls are no-ops (streak and ended stay frozen)', () => {
    let state = createEndlessState()
    for (let i = 0; i < 7; i++) state = applyEndlessCorrect(state)
    state = applyEndlessMiss(state)
    const frozen = { ...state }
    state = applyEndlessCorrect(state)
    expect(state).toEqual(frozen)
    state = applyEndlessMiss(state)
    expect(state).toEqual(frozen)
  })

  it('streak can climb arbitrarily high (no implicit cap, matching "Endless" / infinite questions)', () => {
    let state = createEndlessState()
    for (let i = 0; i < 237; i++) state = applyEndlessCorrect(state)
    expect(state.streak).toBe(237)
    expect(state.ended).toBe(false)
  })
})
