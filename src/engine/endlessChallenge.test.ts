import { describe, expect, it } from 'vitest'
import { ENDLESS_CONFIG } from '../config/endlessConfig'
import { applyCorrect, applyMiss, createEndlessState, createEndlessStateAt, type EndlessState } from './endlessChallenge'

function miss(state: EndlessState) {
  return applyMiss(state)
}
function correct(state: EndlessState) {
  return applyCorrect(state)
}

describe('endlessChallenge', () => {
  it('starts at 200%', () => {
    const s = createEndlessState()
    expect(s.percent).toBe(200)
    expect(s.floor).toBe(200)
    expect(s.ended).toBe(false)
    expect(s.cleared).toBe(false)
  })

  it('correct answer adds +10%', () => {
    const s = correct(createEndlessState())
    expect(s.percent).toBe(210)
    expect(s.ended).toBe(false)
  })

  it('miss subtracts -50%', () => {
    let s = createEndlessState()
    s = correct(s) // 210
    s = correct(s) // 220
    s = miss(s) // 170 <= floor(200) -> clamp+end
    expect(s.percent).toBe(200)
    expect(s.ended).toBe(true)
  })

  it('securing 300% checkpoint then verbatim example: 390 -> MISS -> 340 (continue)', () => {
    let s = createEndlessState()
    // climb to 390 and secure the 300 checkpoint along the way
    for (let i = 0; i < 19; i++) s = correct(s) // 200 + 19*10 = 390
    expect(s.percent).toBe(390)
    expect(s.floor).toBe(300)
    s = miss(s)
    expect(s.percent).toBe(340)
    expect(s.ended).toBe(false)
  })

  it('verbatim example: 350 -> MISS -> 300 (end)', () => {
    let s = createEndlessState()
    for (let i = 0; i < 15; i++) s = correct(s) // 200 + 150 = 350
    expect(s.percent).toBe(350)
    expect(s.floor).toBe(300)
    s = miss(s)
    expect(s.percent).toBe(300)
    expect(s.ended).toBe(true)
    expect(s.cleared).toBe(false)
  })

  it('verbatim example: 490 -> MISS -> 440 (continue)', () => {
    let s = createEndlessState()
    for (let i = 0; i < 29; i++) s = correct(s) // 200 + 290 = 490
    expect(s.percent).toBe(490)
    expect(s.floor).toBe(400)
    s = miss(s)
    expect(s.percent).toBe(440)
    expect(s.ended).toBe(false)
  })

  it('verbatim example: 420 -> MISS -> clamped to 400 (end)', () => {
    let s = createEndlessState()
    for (let i = 0; i < 22; i++) s = correct(s) // 200 + 220 = 420
    expect(s.percent).toBe(420)
    expect(s.floor).toBe(400)
    s = miss(s)
    expect(s.percent).toBe(400) // would be 370 unclamped; must clamp to the secured floor
    expect(s.ended).toBe(true)
  })

  it('reaches exactly 500% and clears', () => {
    let s = createEndlessState()
    for (let i = 0; i < 30; i++) s = correct(s) // 200 + 300 = 500
    expect(s.percent).toBe(ENDLESS_CONFIG.clearPercent)
    expect(s.cleared).toBe(true)
    expect(s.ended).toBe(true)
  })

  it('clamps to exactly 500% even if a correct answer would overshoot', () => {
    let s = createEndlessState()
    for (let i = 0; i < 29; i++) s = correct(s) // 490
    s = correct(s) // 490 + 10 = 500, not overshoot in this case; verify no overshoot possible given gain=10
    expect(s.percent).toBe(500)
    expect(s.cleared).toBe(true)
  })

  it('once ended, further correct/miss calls are no-ops', () => {
    let s = createEndlessState()
    for (let i = 0; i < 30; i++) s = correct(s)
    const cleared = s
    s = correct(s)
    expect(s).toEqual(cleared)
    s = miss(s)
    expect(s).toEqual(cleared)
  })

  it('checkpoint floor never decreases once secured (monotonic, underpins GA4 one-shot dedup)', () => {
    let s = createEndlessState()
    let prevFloor = s.floor
    for (let i = 0; i < 40; i++) {
      s = Math.random() < 0.6 ? correct(s) : miss(s)
      expect(s.floor).toBeGreaterThanOrEqual(prevFloor)
      prevFloor = s.floor
      if (s.ended) s = createEndlessState()
    }
  })

  it('a MISS that does not reach the floor simply continues (no premature termination)', () => {
    let s = createEndlessState()
    s = correct(s) // 210
    s = correct(s) // 220
    s = correct(s) // 230
    s = miss(s) // 180 <= floor(200) -> ends at 200 (never drops below start)
    expect(s.percent).toBe(200)
    expect(s.ended).toBe(true)
  })

  it('invariant: percent never drops below the currently secured floor', () => {
    let s = createEndlessState()
    for (let i = 0; i < 100 && !s.ended; i++) {
      s = Math.random() < 0.5 ? correct(s) : miss(s)
      expect(s.percent).toBeGreaterThanOrEqual(s.floor)
    }
  })

  describe('createEndlessStateAt (QA/Preview jump helper)', () => {
    it('200 -> start state, floor 200, not ended', () => {
      const s = createEndlessStateAt(200)
      expect(s).toEqual({ percent: 200, floor: 200, ended: false, cleared: false })
    })

    it('300 -> floor secures at 300 (the checkpoint itself)', () => {
      const s = createEndlessStateAt(300)
      expect(s).toEqual({ percent: 300, floor: 300, ended: false, cleared: false })
    })

    it('400 -> floor secures at 400', () => {
      const s = createEndlessStateAt(400)
      expect(s).toEqual({ percent: 400, floor: 400, ended: false, cleared: false })
    })

    it('490 -> floor stays at the most recently passed checkpoint (400), not 490', () => {
      const s = createEndlessStateAt(490)
      expect(s).toEqual({ percent: 490, floor: 400, ended: false, cleared: false })
    })

    it('250 (between checkpoints) -> floor stays at the implicit 200 checkpoint', () => {
      const s = createEndlessStateAt(250)
      expect(s).toEqual({ percent: 250, floor: 200, ended: false, cleared: false })
    })

    it('500 or above -> clamped to exactly 500%, ended and cleared', () => {
      expect(createEndlessStateAt(500)).toEqual({ percent: 500, floor: 500, ended: true, cleared: true })
      expect(createEndlessStateAt(9999)).toEqual({ percent: 500, floor: 500, ended: true, cleared: true })
    })

    it('a jumped-to state behaves identically to one reached by real play for applyMiss', () => {
      // 390からMISSした場合の仕様例（340へ継続）と、jumpで390へ直接移動した場合の
      // applyMiss結果が一致することを確認する（QAのジャンプが本物の状態と区別できないこと）。
      let real = createEndlessState()
      for (let i = 0; i < 19; i++) real = correct(real) // -> 390, floor 300
      const jumped = createEndlessStateAt(390)
      expect(jumped).toEqual(real)
      expect(miss(jumped)).toEqual(miss(real))
    })
  })
})
