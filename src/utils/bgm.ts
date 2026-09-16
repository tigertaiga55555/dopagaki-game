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
/** Ver.5.0: FINAL DOPA TRIAL専用BGMのBPM。OVERDRIVEよりわずかに遅くし、
 *  「速さ」ではなく「重さ・緊迫感（ボス戦）」で威圧するテンポにする。 */
const FINAL_BPM = 150

let running = false
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let nextNoteTime = 0
let stepIndex = 0
let stageRef = 0
/** 現在のCOMBO数（生値）。5/10/15/20/25の節目で段階的にレイヤーを追加する（Ver.4.5）。
 *  MISSでcomboRefが0に戻ると、この値も次のtickで即座に0へ戻り、追加レイヤーも自動的に消える。 */
let comboCountRef = 0
let overdriveMode = false
/** Ver.5.0: FINAL DOPA TRIAL専用BGMモード。trueの間は通常/OVERDRIVEの全レイヤーを完全に
 *  差し替え、専用のボス戦パターン（重いベース・金属質パーカッション・不穏なシンセ・
 *  ハートビート感のキック）だけを鳴らす。 */
let finalMode = false
/** Ver.5.0: FINAL DOPA TRIALの問題番号（1〜16）に応じて0〜3の4段階でレイヤーを積み増す。 */
let finalIntensityRef = 0
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
  if (finalMode) return FINAL_BPM
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

/** COMBO5〜：軽い追加シンセ */
function playComboSynth(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 660
  gain.gain.setValueAtTime(0.001, time)
  gain.gain.linearRampToValueAtTime(0.03, time + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16)
  osc.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.18)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

/** COMBO10〜：低音アクセント */
function playComboBassAccent(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(90, time)
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.1)
  gain.gain.setValueAtTime(0.1, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
  osc.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.16)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

/** COMBO15〜：高音アルペジオ（3音の駆け上がり） */
function playComboArpeggio(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  ;[1320, 1568, 1760].forEach((freq, i) => {
    const t = time + i * 0.06
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.035, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(gain)
    gain.connect(out)
    osc.start(t)
    osc.stop(t + 0.12)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  })
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

/** Ver.4.7: OVERDRIVE専用の強い低音。「隠しステージに入った」感を出すため通常ベースより太くする */
function playOverdriveBass(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(62, time)
  osc.frequency.exponentialRampToValueAtTime(41, time + 0.2)
  filter.type = 'lowpass'
  filter.frequency.value = 320
  gain.gain.setValueAtTime(0.16, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.32)
  osc.onended = () => {
    osc.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

/** Ver.4.7: OVERDRIVE専用のアルペジオ（COMBOアルペジオより速く広い駆け上がり） */
function playOverdriveArpeggio(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  ;[988, 1245, 1480, 1976].forEach((freq, i) => {
    const t = time + i * 0.045
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.03, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(gain)
    gain.connect(out)
    osc.start(t)
    osc.stop(t + 0.1)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  })
}

/** Ver.4.7: 「黄金サイレン」の音版。パトランプの回転灯のような短い上下スイープを1小節に1回鳴らす */
function playOverdriveSiren(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(650, time)
  osc.frequency.linearRampToValueAtTime(1350, time + 0.3)
  osc.frequency.linearRampToValueAtTime(650, time + 0.6)
  gain.gain.setValueAtTime(0.001, time)
  gain.gain.linearRampToValueAtTime(0.045, time + 0.15)
  gain.gain.linearRampToValueAtTime(0.001, time + 0.6)
  osc.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.62)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
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

/** Ver.5.0: FINAL専用「ハートビート」キック。低い一撃のすぐ後にもう一段低い残響を重ね、
 *  心臓の鼓動のような「ドッ、ドッ…」を作る（通常のplayKickより低く・重い）。 */
function playFinalHeartbeatKick(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  ;[0, 0.09].forEach((offset, i) => {
    const t = time + offset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(i === 0 ? 110 : 70, t)
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.16)
    gain.gain.setValueAtTime(i === 0 ? 0.26 : 0.16, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    osc.connect(gain)
    gain.connect(out)
    osc.start(t)
    osc.stop(t + 0.24)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  })
}

/** Ver.5.0: FINAL専用の細かいハイハット（通常より速く鳴らし、緊迫感を出す）。 */
function playFinalHat(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 8500
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.03, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  src.start(time)
  src.stop(time + 0.04)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

/** Ver.5.0: FINAL専用の金属質パーカッション（狭いbandpassで高いQ＝金属を叩いたような質感）。 */
function playFinalMetal(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 3600
  filter.Q.value = 8
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.05, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  src.start(time)
  src.stop(time + 0.15)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

/** Ver.5.0: FINAL専用の不穏なシンセパッド（2音をわずかにデチューンして唸らせる）。 */
function playFinalOminousPad(time: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  ;[110, 111.5].forEach((freq) => {
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    filter.type = 'lowpass'
    filter.frequency.value = 500
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(0.05, time + 0.4)
    gain.gain.linearRampToValueAtTime(0.001, time + 1.6)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    osc.start(time)
    osc.stop(time + 1.65)
    osc.onended = () => {
      osc.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
  })
}

/** Ver.5.0: FINAL専用のサブベース（超低音、常時流れる緊張感のベースライン）。 */
function playFinalSubBass(time: number, intensity: number) {
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 41
  gain.gain.setValueAtTime(0.14 + intensity * 0.02, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5)
  osc.connect(gain)
  gain.connect(out)
  osc.start(time)
  osc.stop(time + 0.52)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

/**
 * Ver.5.0: FINAL DOPA TRIAL専用BGM本体。通常/OVERDRIVEの全レイヤーとは完全に独立した
 * 別パターン（10. ボス戦のような緊張感：速く重いベース、細かいハイハット、金属質
 * パーカッション、不穏なシンセ、ハートビート感のキック）。finalIntensityRef（0〜3）に
 * 応じて段階的にレイヤーが増える（問題が進むほど専用BGMも激しくなる）。
 * 問題の正誤判定SE自体はsound.tsの別ゲインノードを通るため、ここでどれだけ重ねても
 * 判定音が聞こえなくなることはない。
 */
function scheduleFinalStep(step: number, time: number) {
  const beat = Math.floor(step / STEPS_PER_BEAT)
  const sub = step % STEPS_PER_BEAT
  const intensity = finalIntensityRef

  // ハートビートキック：1拍目・3拍目の頭に必ず（心臓の鼓動のように規則正しく）
  if (sub === 0 && (beat === 0 || beat === 2)) {
    playFinalHeartbeatKick(time)
  }
  // サブベース：ハートビートキックと同期
  if (sub === 0 && (beat === 0 || beat === 2)) {
    playFinalSubBass(time, intensity)
  }
  // 細かいハイハット：常時16分で刻み続け緊迫感を作る
  playFinalHat(time)
  // 金属質パーカッション：intensity>=1から、小節の裏拍に
  if (intensity >= 1 && sub === 2 && (beat === 1 || beat === 3)) {
    playFinalMetal(time)
  }
  // 不穏なシンセパッド：intensity>=2から、小節頭に長く伸ばす
  if (intensity >= 2 && step % STEPS_PER_BAR === 0) {
    playFinalOminousPad(time)
  }
  // 最高強度：intensity>=3で追加の金属パーカッションを増やし密度を上げる
  if (intensity >= 3 && sub === 2) {
    playFinalMetal(time)
  }
}

function scheduleStep(step: number, time: number) {
  if (finalMode) {
    scheduleFinalStep(step, time)
    return
  }
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

  // Ver.4.5: COMBOの節目ごとに段階的にレイヤーを積む。MISSでcomboCountRefが0に戻れば
  // 次のtickから自動的にすべて消える（正解を積み直すとまた戻ってくる）。
  const combo = comboCountRef
  if (combo >= 5 && step % 8 === 4) {
    playComboSynth(time)
  }
  if (combo >= 10 && sub === 0 && beat === 1) {
    playComboBassAccent(time)
  }
  if (combo >= 15 && step % STEPS_PER_BAR === 8) {
    playComboArpeggio(time)
  }
  if (combo >= 20 && sub === 2) {
    playPerc(time)
  }
  if (combo >= 25 && sub === 2 && beat % 2 === 1) {
    playShimmer(time, Math.min(1, combo / 30))
  }

  // Ver.4.7: OVERDRIVE中は「隠しステージに入った」と感じる専用レイヤーを重ねる
  // （通常の終盤BGM＋COMBOレイヤーの上に、さらに強い低音・専用アルペジオ・黄金サイレンを追加）
  if (overdriveMode) {
    if (sub === 0) {
      playOverdriveStab(time)
      playOverdriveBass(time)
    }
    if (sub === 2) {
      playPerc(time)
    }
    if (step % STEPS_PER_BAR === 12) {
      playOverdriveArpeggio(time)
    }
    if (step % STEPS_PER_BAR === 0) {
      playOverdriveSiren(time)
    }
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
  finalMode = false
  finalIntensityRef = 0
  stageRef = 0
  comboCountRef = 0
  stepIndex = 0
  nextNoteTime = ctx.currentTime + 0.08
  schedulerTimer = setInterval(scheduler, SCHEDULER_INTERVAL_MS)
}

export function stopBgm() {
  running = false
  overdriveMode = false
  finalMode = false
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

/** stage: 0〜5（フェーズ番号と対応）。comboCount: 現在のCOMBO数（生値、5/10/15/20/25の節目でレイヤー追加）。 */
export function setBgmProgress(stage: number, comboCount: number) {
  stageRef = stage
  comboCountRef = Math.max(0, comboCount)
}

export function setOverdriveMode(active: boolean) {
  overdriveMode = active
}

/** Ver.5.0: FINAL DOPA TRIAL専用BGMモードの切り替え。trueの間は通常/OVERDRIVEの
 *  全レイヤーが完全に無効化され、scheduleFinalStep()だけが鳴る。 */
export function setFinalMode(active: boolean) {
  finalMode = active
  if (active) overdriveMode = false
}

/** Ver.5.0: FINAL DOPA TRIALの問題進行（0〜3）に応じてBGMレイヤーを段階的に増やす。 */
export function setFinalIntensity(level: number) {
  finalIntensityRef = Math.max(0, Math.min(3, level))
}

/**
 * Ver.4.5: 残り20秒付近から薄いライザー／上昇音を足し、「終盤に向かっている」感触を
 * プレイヤーが明確に意識しなくても伝える。FINAL DOPA RUSH本編のsirenとは別の、
 * もっと控えめなレイヤー。
 */
export function playLateGameSweetener(): void {
  if (isMuted()) return
  const ctx = getAudioContext()
  const out = getBgmGain()
  if (!ctx || !out) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  const now = ctx.currentTime
  osc.frequency.setValueAtTime(500, now)
  osc.frequency.linearRampToValueAtTime(900, now + 1.2)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.025, now + 0.6)
  gain.gain.linearRampToValueAtTime(0.001, now + 1.3)
  osc.connect(gain)
  gain.connect(out)
  osc.start(now)
  osc.stop(now + 1.35)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}
