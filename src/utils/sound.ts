import { getAudioContext, getSfxGain, isMuted, setMuted } from './audioContext'

export { isMuted, setMuted }

function beep(freq: number, durationMs: number, type: OscillatorType = 'sine', gainValue = 0.12) {
  if (isMuted()) return
  const ctx = getAudioContext()
  const gainOut = getSfxGain()
  if (!ctx || !gainOut) return
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const now = ctx.currentTime
  gain.gain.setValueAtTime(gainValue, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  osc.connect(gain)
  gain.connect(gainOut)
  osc.start(now)
  osc.stop(now + durationMs / 1000)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

/** HOLD中の「充填音」。押している間ずっと鳴り続け、requiredMsで音程が上がりきるように設計。 */
function startHoldCharge(durationMs: number): () => void {
  if (isMuted()) return () => {}
  const ctx = getAudioContext()
  const gainOut = getSfxGain()
  if (!ctx || !gainOut) return () => {}
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  const now = ctx.currentTime
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.linearRampToValueAtTime(760, now + durationMs / 1000)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(0.045, now + 0.05)
  osc.connect(gain)
  gain.connect(gainOut)
  osc.start(now)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    try {
      const t = ctx.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.05)
      osc.stop(t + 0.07)
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
    } catch {
      // すでに停止している場合は無視
    }
  }
}

/** 連続正解の節目SE。levelが上がるほど明るく派手にする。 */
function comboMilestone(level: 1 | 2 | 3 | 4 | 5) {
  const base = 700 + level * 140
  beep(base, 90, 'triangle', 0.09 + level * 0.01)
  setTimeout(() => beep(base * 1.5, 110, 'sine', 0.1 + level * 0.01), 70)
  if (level >= 4) setTimeout(() => beep(base * 2, 140, 'sine', 0.1), 150)
}

/**
 * Ver.4.5: 連続正解時の判定SE。comboが伸びるほど音程が少しずつ上がっていく簡単な音階。
 * 耳障りにならないよう、上限で頭打ちにして高音になりすぎないようにする。
 */
function comboPitchedTier(tier: 'PERFECT' | 'GREAT' | 'GOOD', combo: number) {
  const step = Math.min(combo, 12)
  const pitchMul = 1 + step * 0.025
  if (tier === 'PERFECT') {
    beep(1200 * pitchMul, 100, 'sine', 0.12)
    setTimeout(() => beep(1600 * pitchMul, 100, 'sine', 0.1), 60)
  } else if (tier === 'GREAT') {
    beep(950 * pitchMul, 90, 'sine', 0.1)
  } else {
    beep(760 * pitchMul, 80, 'sine', 0.08)
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
  comboBreak: () => {
    beep(300, 140, 'sawtooth', 0.1)
    setTimeout(() => beep(180, 200, 'sawtooth', 0.1), 90)
  },
  finalRushAlarm: () => {
    // ウーッ、ウーッ、というサイレン風の短い上下スイープ
    beep(520, 90, 'square', 0.08)
    setTimeout(() => beep(700, 110, 'square', 0.08), 100)
  },
  /** Ver.4.5: 残り5秒で一度だけ鳴らす、サイレンとは別レイヤーの警告ビープ */
  finalWarningBeep: () => {
    beep(1400, 90, 'square', 0.12)
    setTimeout(() => beep(1400, 90, 'square', 0.12), 160)
  },
  /** Ver.4.5: 残り3・2・1の画面カウントに合わせて鳴らす強めのカウント音 */
  countdownBeep: (value: number) => {
    const freq = value <= 1 ? 2000 : value === 2 ? 1700 : 1450
    beep(freq, 140, 'square', 0.18)
  },
  hundred: () => {
    // Ver.4.5: 60秒で一番気持ちいい瞬間にするため、爆発後にもう一段華やかなきらめきを重ねる
    beep(1400, 160, 'sine', 0.14)
    setTimeout(() => beep(1900, 240, 'sine', 0.14), 140)
    setTimeout(() => beep(2400, 200, 'sine', 0.1), 260)
    setTimeout(() => beep(3000, 260, 'triangle', 0.08), 340)
  },
  overdrive: () => {
    beep(2100, 100, 'sawtooth', 0.16)
    setTimeout(() => beep(2600, 260, 'sawtooth', 0.16), 90)
  },
  /** GOまで押すな：GO表示の合図音 */
  go: () => beep(1300, 70, 'sine', 0.1),
  /** SKIP待ち：SKIP表示の合図音 */
  skip: () => beep(1000, 60, 'square', 0.08),
  /** SKIP待ち：SKIP成功タップ時の「ピッ！」 */
  skipHit: () => beep(1400, 55, 'sine', 0.09),
  /** 連打→急停止：「止まれ！」に切り替わる瞬間のブレーキ音 */
  brake: () => beep(220, 120, 'sawtooth', 0.11),
  /** 100で止めろ：停止した瞬間の音（ピッタリ100ならより派手に） */
  stopAt100: (isPerfect: boolean) => {
    beep(isPerfect ? 1500 : 850, isPerfect ? 130 : 70, 'sine', isPerfect ? 0.14 : 0.08)
    if (isPerfect) setTimeout(() => beep(2000, 150, 'sine', 0.12), 80)
  },
  /** 98〜102 STOP：タップした瞬間の「カッ！」（判定音とは別レイヤー） */
  stopClick: () => beep(1100, 35, 'square', 0.06),
  /** 通知を消せ：1個消すたびのポン */
  notifPop: () => beep(700 + Math.random() * 200, 45, 'triangle', 0.06),
  /** 高速仕分け：スワイプ成功時の「シュッ！」 */
  swipeSuccess: () => beep(500, 60, 'sawtooth', 0.05),
  /** HOLD：押している間の充填音（停止関数を返す）／完了時の「ピン！」 */
  startHoldCharge,
  holdComplete: () => beep(1700, 90, 'sine', 0.13),
  /** 連続正解の節目（5/10/15/20/25） */
  comboMilestone,
  /** 連続正解時の判定音（音程がcomboに応じて少しずつ上がる） */
  comboPitchedTier,
  /** Ver.4.5「1→4」：タップごとに音程が上がる */
  sequenceTap: (value: number) => beep(700 + value * 130, 55, 'square', 0.07),
  /** Ver.4.5「ターゲットを探せ」：発見時の短い音 */
  targetFound: () => beep(1300, 60, 'sine', 0.09),
  /** Ver.4.5「緑で離せ」：ゾーン内で離せた瞬間の成功音 */
  zoneRelease: () => beep(1500, 100, 'sine', 0.12),
  /** Ver.4.5「文字の色」：正答時の短い認知正解音 */
  colorWordHit: () => beep(1050, 65, 'triangle', 0.08),
  /** Ver.4.5「光ったやつ」：発光時の軽いキラッ */
  flashTick: () => beep(1900, 45, 'sine', 0.05),
  /** Ver.4.5「通知ラッシュ」：バッジ出現音（ごく軽く） */
  notifSpawn: () => beep(650, 20, 'sine', 0.02),
}
