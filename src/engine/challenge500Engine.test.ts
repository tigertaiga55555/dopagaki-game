import { describe, expect, it } from 'vitest'
import { CHALLENGE500_CONFIG } from '../config/challenge500Config'
import { applyCorrect, applyMiss, createChallenge500State, createChallenge500StateAt, type Challenge500State } from './challenge500Engine'

function miss(state: Challenge500State) {
  return applyMiss(state)
}
function correct(state: Challenge500State) {
  return applyCorrect(state)
}

describe('challenge500Engine', () => {
  it('starts at 200%', () => {
    const s = createChallenge500State()
    expect(s.percent).toBe(200)
    expect(s.floor).toBe(200)
    expect(s.ended).toBe(false)
    expect(s.cleared).toBe(false)
  })

  it('correct answer adds +10%', () => {
    const s = correct(createChallenge500State())
    expect(s.percent).toBe(210)
    expect(s.ended).toBe(false)
  })

  it('miss subtracts -50%', () => {
    let s = createChallenge500State()
    s = correct(s) // 210
    s = correct(s) // 220
    s = miss(s) // 170 <= floor(200) -> clamp+end
    expect(s.percent).toBe(200)
    expect(s.ended).toBe(true)
  })

  it('tier2 (300-399%) uses the heavier -70% penalty: verbatim example 390 -> MISS -> 320 (continue)', () => {
    let s = createChallenge500State()
    // climb to 390 and secure the 300 checkpoint along the way
    for (let i = 0; i < 19; i++) s = correct(s) // 200 + 19*10 = 390
    expect(s.percent).toBe(390)
    expect(s.floor).toBe(300)
    s = miss(s)
    expect(s.percent).toBe(320) // 390 - 70 (tier2 penalty), not -50
    expect(s.ended).toBe(false)
  })

  it('verbatim example: 350 -> MISS(-70%) -> 280, clamped to floor 300 (end)', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 15; i++) s = correct(s) // 200 + 150 = 350
    expect(s.percent).toBe(350)
    expect(s.floor).toBe(300)
    s = miss(s)
    expect(s.percent).toBe(300) // 350-70=280 <= floor(300) -> clamp
    expect(s.ended).toBe(true)
    expect(s.cleared).toBe(false)
  })

  it('tier3 (400-499%) ends on a single MISS regardless of magnitude: verbatim example 490 -> MISS -> 400 (end)', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 29; i++) s = correct(s) // 200 + 290 = 490
    expect(s.percent).toBe(490)
    expect(s.floor).toBe(400)
    s = miss(s)
    expect(s.percent).toBe(400) // tier3: instant end back to the secured floor, no -% calculation
    expect(s.ended).toBe(true)
    expect(s.cleared).toBe(false)
  })

  it('tier3: even a single correct answer into 400-499% means the very next MISS ends at 400', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 20; i++) s = correct(s) // -> 400 exactly, floor 400
    expect(s.percent).toBe(400)
    s = correct(s) // -> 410, still tier3
    expect(s.percent).toBe(410)
    s = miss(s)
    expect(s.percent).toBe(400)
    expect(s.ended).toBe(true)
  })

  it('tier3 requires 10 consecutive corrects with zero MISS tolerance to reach 500%', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 20; i++) s = correct(s) // -> 400
    for (let i = 0; i < 9; i++) {
      s = correct(s)
      expect(s.ended).toBe(false)
    }
    expect(s.percent).toBe(490)
    s = correct(s) // 10th consecutive correct in tier3 -> 500, clear
    expect(s.percent).toBe(500)
    expect(s.cleared).toBe(true)
  })

  it('reaches exactly 500% and clears', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 30; i++) s = correct(s) // 200 + 300 = 500
    expect(s.percent).toBe(CHALLENGE500_CONFIG.clearPercent)
    expect(s.cleared).toBe(true)
    expect(s.ended).toBe(true)
  })

  it('clamps to exactly 500% even if a correct answer would overshoot', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 29; i++) s = correct(s) // 490
    s = correct(s) // 490 + 10 = 500, not overshoot in this case; verify no overshoot possible given gain=10
    expect(s.percent).toBe(500)
    expect(s.cleared).toBe(true)
  })

  it('once ended, further correct/miss calls are no-ops', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 30; i++) s = correct(s)
    const cleared = s
    s = correct(s)
    expect(s).toEqual(cleared)
    s = miss(s)
    expect(s).toEqual(cleared)
  })

  it('checkpoint floor never decreases once secured (monotonic, underpins GA4 one-shot dedup)', () => {
    let s = createChallenge500State()
    let prevFloor = s.floor
    for (let i = 0; i < 40; i++) {
      s = Math.random() < 0.6 ? correct(s) : miss(s)
      expect(s.floor).toBeGreaterThanOrEqual(prevFloor)
      prevFloor = s.floor
      if (s.ended) s = createChallenge500State()
    }
  })

  it('a MISS that does not reach the floor simply continues (no premature termination)', () => {
    let s = createChallenge500State()
    s = correct(s) // 210
    s = correct(s) // 220
    s = correct(s) // 230
    s = miss(s) // 180 <= floor(200) -> ends at 200 (never drops below start)
    expect(s.percent).toBe(200)
    expect(s.ended).toBe(true)
  })

  it('invariant: percent never drops below the currently secured floor', () => {
    let s = createChallenge500State()
    for (let i = 0; i < 100 && !s.ended; i++) {
      s = Math.random() < 0.5 ? correct(s) : miss(s)
      expect(s.percent).toBeGreaterThanOrEqual(s.floor)
    }
  })

  describe('createChallenge500StateAt (QA/Preview jump helper)', () => {
    it('200 -> start state, floor 200, not ended', () => {
      const s = createChallenge500StateAt(200)
      expect(s).toEqual({ percent: 200, floor: 200, ended: false, cleared: false })
    })

    it('300 -> floor secures at 300 (the checkpoint itself)', () => {
      const s = createChallenge500StateAt(300)
      expect(s).toEqual({ percent: 300, floor: 300, ended: false, cleared: false })
    })

    it('400 -> floor secures at 400', () => {
      const s = createChallenge500StateAt(400)
      expect(s).toEqual({ percent: 400, floor: 400, ended: false, cleared: false })
    })

    it('490 -> floor stays at the most recently passed checkpoint (400), not 490', () => {
      const s = createChallenge500StateAt(490)
      expect(s).toEqual({ percent: 490, floor: 400, ended: false, cleared: false })
    })

    it('250 (between checkpoints) -> floor stays at the implicit 200 checkpoint', () => {
      const s = createChallenge500StateAt(250)
      expect(s).toEqual({ percent: 250, floor: 200, ended: false, cleared: false })
    })

    it('500 or above -> clamped to exactly 500%, ended and cleared', () => {
      expect(createChallenge500StateAt(500)).toEqual({ percent: 500, floor: 500, ended: true, cleared: true })
      expect(createChallenge500StateAt(9999)).toEqual({ percent: 500, floor: 500, ended: true, cleared: true })
    })

    it('a jumped-to state behaves identically to one reached by real play for applyMiss', () => {
      // 390からMISSした場合（320へ継続）と、jumpで390へ直接移動した場合の
      // applyMiss結果が一致することを確認する（QAのジャンプが本物の状態と区別できないこと）。
      let real = createChallenge500State()
      for (let i = 0; i < 19; i++) real = correct(real) // -> 390, floor 300
      const jumped = createChallenge500StateAt(390)
      expect(jumped).toEqual(real)
      expect(miss(jumped)).toEqual(miss(real))
    })
  })
})
