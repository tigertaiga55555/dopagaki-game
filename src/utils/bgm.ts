import { getAudioContext, getBgmGain, isMuted } from './audioContext'

/**
 * Ver.4.4: 手続き生成BGM。
 * 「序盤は落ち着いている→連続正解や経過時間とともに音が積み上がる」を実現するため、
 * ルックアヘッド方式のステップシーケンサーで、一定のステップ（16分音符）グリッド上に
 * キック／ハイハット／ベース／パーカッション／シンセを段階的に足していく。
 * テンポは急に切り替えず、ステップごとに現在のBPMを再計算して滑らかに加速させる。
 *
 * ステージ0〜5は既存の6フェーズ（0-10/10-20/20-30/30-40/40-50/50-60秒）にそのまま対応する。
 */

const STEPS_PER_BEAT = 4
const STEPS_PER_BAR = STEPS_PER_BEAT * 4
const LOOKAHEAD_SEC = 0.12
const SCHEDULER_INTERVAL_MS = 25

const STAGE_BPM = [96, 110, 122, 134, 146, 158]
const OVERDRIVE_BPM = 166

let running = false
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let nextNoteTime = 0
let stepIndex = 0
let stageRef = 0
let comboLevelRef = 0
let overdriveMode = false
let noiseBuffer: AudioBuffer | null = null

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 0.3)
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function currentBpm(): number {
  return overdriveMode ? OVERDRIVE_BPM : STAGE_BPM[Math.max(0, Math.min(STAGE_BPM.length - 1, stageRef))]
}

function playKick(time: number, stage: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.14)
  const vol = 0.22 + stage * 0.015
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22)
  osc.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.24)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

function playHat(time: number, stage: number, open: boolean) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7500
  const gain = ctx.createGain()
  const vol = 0.035 + stage * 0.006
  const dur = open ? 0.09 : 0.035
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  src.start(time)
  src.stop(time + dur + 0.01)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

const BASS_NOTES = [55, 55, 61.74, 49] // A1, A1, B1, G1 ふうの単純な動き

function playBass(time: number, stage: number, beatIndex: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = stage >= 3 ? 'sawtooth' : 'triangle'
  osc.frequency.value = BASS_NOTES[beatIndex % BASS_NOTES.length]
  filter.type = 'lowpass'
  filter.frequency.value = 400 + stage * 60
  const vol = 0.12 + stage * 0.01
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.34)
  osc.onended = () => {
    osc.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

function playPerc(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2200
  filter.Q.value = 1.2
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.06, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  src.start(time)
  src.stop(time + 0.09)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

function playShimmer(time: number, intensity: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 1800 + Math.random() * 600
  const vol = 0.02 + intensity * 0.02
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2)
  osc.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.22)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

function playOverdriveStab(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  ;[880, 1108, 1320].forEach((freq) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.045, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
    osc.connect(gain)
    gain.connect(out)
    osc.start(time)
    osc.stop(time + 0.2)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  })
}

/** FINAL DOPA RUSH直前（残り12秒前後）に一度だけ鳴らす、盛り上がりを予感させるライザー。 */
export function playRiser() {
  if (isMuted()) return
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  const now = ctx.currentTime
  osc.frequency.setValueAtTime(120, now)
  osc.frequency.exponentialRampToValueAtTime(1400, now + 1.6)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.06, now + 1.4)
  gain.gain.linearRampToValueAtTime(0.001, now + 1.7)
  osc.connect(gain)
  gain.connect(out)
  osc.start(now)
  osc.stop(now + 1.75)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

function scheduleStep(step: number, time: number) {
  const stage = stageRef
  const beat = Math.floor(step / STEPS_PER_BEAT)
  const sub = step % STEPS_PER_BEAT

  // キック：ステージ0は2拍のみ（余裕がある）、以降は4つ打ち
  if (sub === 0 && (stage > 0 || beat === 0 || beat === 2)) {
    playKick(time, stage)
  }
  // ハイハット：ステージ1から8分でオフビート、ステージ3以降は16分を追加
  if (stage >= 1 && (sub === 2 || (stage >= 3 && sub !== 0))) {
    playHat(time, stage, sub === 2)
  }
  // ベース：ステージ1から1拍・3拍目に
  if (stage >= 1 && sub === 0 && (beat === 0 || beat === 2)) {
    playBass(time, stage, Math.floor(step / STEPS_PER_BAR) + beat)
  }
  // 追加パーカッション：ステージ3以降、小節の最後の16分に
  if (stage >= 3 && step % STEPS_PER_BAR === STEPS_PER_BAR - 1) {
    playPerc(time)
  }
  // COMBOによるきらめき：高COMBO時にオフビートで追加
  if (comboLevelRef > 0.5 && sub === 2 && beat % 2 === 1) {
    playShimmer(time, comboLevelRef)
  }
  // OVERDRIVE：拍頭に高音シンセを重ねる
  if (overdriveMode && sub === 0) {
    playOverdriveStab(time)
  }
}

function scheduler() {
  const ctx = getAudioContext()
  if (!ctx || !running) return
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD_SEC) {
    scheduleStep(stepIndex, nextNoteTime)
    const stepSec = 60 / currentBpm() / STEPS_PER_BEAT
    nextNoteTime += stepSec
    stepIndex = (stepIndex + 1) % STEPS_PER_BAR
  }
}

export function startBgm() {
  const ctx = getAudioContext()
  if (!ctx || running) return
  running = true
  overdriveMode = false
  stageRef = 0
  comboLevelRef = 0
  stepIndex = 0
  nextNoteTime = ctx.currentTime + 0.08
  schedulerTimer = setInterval(scheduler, SCHEDULER_INTERVAL_MS)
}

export function stopBgm() {
  running = false
  overdriveMode = false
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

/** stage: 0〜5（フェーズ番号と対応）。comboLevel: 0〜1（COMBOに応じた演出強度）。 */
export function setBgmProgress(stage: number, comboLevel: number) {
  stageRef = stage
  comboLevelRef = Math.max(0, Math.min(1, comboLevel))
}

export function setOverdriveMode(active: boolean) {
  overdriveMode = active
}
