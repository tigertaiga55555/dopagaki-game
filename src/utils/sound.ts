let audioCtx: AudioContext | null = null
let muted = false

try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem('dopagaki:muted') === '1'
} catch {
  muted = false
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      audioCtx = new Ctor()
    } catch {
      return null
    }
  }
  return audioCtx
}

function beep(freq: number, durationMs: number, type: OscillatorType = 'sine', gainValue = 0.12) {
  if (muted) return
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const now = ctx.currentTime
  gain.gain.setValueAtTime(gainValue, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durationMs / 1000)
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem('dopagaki:muted', value ? '1' : '0')
  } catch {
    // no-op
  }
}

export const sfx = {
  tap: () => beep(600, 50, 'square', 0.05),
  perfect: () => {
    beep(1200, 100, 'sine', 0.12)
    setTimeout(() => beep(1600, 100, 'sine', 0.1), 60)
  },
  great: () => beep(950, 90, 'sine', 0.1),
  good: () => beep(760, 80, 'sine', 0.08),
  miss: () => beep(150, 180, 'sawtooth', 0.12),
  comboUp: () => beep(900 + Math.random() * 300, 50, 'triangle', 0.05),
  finalRushAlarm: () => beep(440, 160, 'square', 0.09),
  hundred: () => {
    beep(1400, 160, 'sine', 0.14)
    setTimeout(() => beep(1900, 240, 'sine', 0.14), 140)
  },
  overdrive: () => {
    beep(2100, 100, 'sawtooth', 0.16)
    setTimeout(() => beep(2600, 260, 'sawtooth', 0.16), 90)
  },
  /** GOまで押すな：GO表示の合図音 */
  go: () => beep(1300, 70, 'sine', 0.1),
  /** SKIP待ち：SKIP表示の合図音 */
  skip: () => beep(1000, 60, 'square', 0.08),
  /** 連打→急停止：「止まれ！」に切り替わる瞬間のブレーキ音 */
  brake: () => beep(220, 120, 'sawtooth', 0.11),
  /** 100で止めろ：停止した瞬間の音（ピッタリ100ならより派手に） */
  stopAt100: (isPerfect: boolean) => {
    beep(isPerfect ? 1500 : 850, isPerfect ? 130 : 70, 'sine', isPerfect ? 0.14 : 0.08)
    if (isPerfect) setTimeout(() => beep(2000, 150, 'sine', 0.12), 80)
  },
  /** 通知を消せ：1個消すたびのポン */
  notifPop: () => beep(700 + Math.random() * 200, 45, 'triangle', 0.06),
}
