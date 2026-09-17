/**
 * Ver.4.4: BGMとSEで共有するAudioContextと、その2系統のマスターゲイン（bgm/sfx）を管理する。
 * ミュートはこの2つのゲインを同時に操作することで「一括ミュート」を実現しつつ、
 * BGMとSEの音量は内部的に別管理できるようにしている。
 *
 * iPhone Safariの自動再生制限に対応するため、AudioContextの生成・resumeは
 * 必ずユーザー操作（STARTボタン押下）の同期的なコールバック内から呼ばれる
 * unlockAudio()で行う。
 */

export const BGM_BASE_GAIN = 0.55
export const SFX_BASE_GAIN = 1

let audioCtx: AudioContext | null = null
let sfxGain: GainNode | null = null
let bgmGain: GainNode | null = null
let masterCompressor: DynamicsCompressorNode | null = null
let muted = false

try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem('dopagaki:muted') === '1'
} catch {
  muted = false
}

/**
 * Ver.5.0追加: FINAL突入音・200%ファンファーレをレイヤー強化するにあたり、単純にgainを
 * 上げるだけでは音割れ（クリッピング）が起きる。sfxGain/bgmGainの出力を、destinationへ
 * 直接つなぐのではなく共通のmaster compressor（limiter相当）を経由させることで、
 * 複数レイヤーが同時に重なってもiPhone Safariのスピーカーで潰れないようにする。
 */
function ensureGraph(ctx: AudioContext) {
  if (!masterCompressor) {
    masterCompressor = ctx.createDynamicsCompressor()
    masterCompressor.threshold.value = -16
    masterCompressor.knee.value = 24
    masterCompressor.ratio.value = 6
    masterCompressor.attack.value = 0.003
    masterCompressor.release.value = 0.25
    masterCompressor.connect(ctx.destination)
  }
  if (!sfxGain) {
    sfxGain = ctx.createGain()
    sfxGain.gain.value = muted ? 0 : SFX_BASE_GAIN
    sfxGain.connect(masterCompressor)
  }
  if (!bgmGain) {
    bgmGain = ctx.createGain()
    bgmGain.gain.value = muted ? 0 : BGM_BASE_GAIN
    bgmGain.connect(masterCompressor)
  }
}

export function getAudioContext(): AudioContext | null {
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
  ensureGraph(audioCtx)
  return audioCtx
}

export function getSfxGain(): GainNode | null {
  getAudioContext()
  return sfxGain
}

export function getBgmGain(): GainNode | null {
  getAudioContext()
  return bgmGain
}

/**
 * STARTボタン押下など、ユーザー操作の同期コールバック内で必ず呼ぶこと。
 * iPhone Safariではユーザージェスチャーの外でresume()しても効果がないため。
 * リトライ時もこの関数を呼んで構わない（既存contextを再利用し、二重生成しない）。
 * 前回プレイの終盤に予約されたゲイン自動化（ダッキング等）が新しいプレイに漏れ出さないよう、
 * ここで必ずキャンセルしてミュート状態に応じた基準値へスナップし直す。
 */
export function unlockAudio(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  const now = ctx.currentTime
  if (sfxGain) {
    sfxGain.gain.cancelScheduledValues(now)
    sfxGain.gain.setValueAtTime(muted ? 0 : SFX_BASE_GAIN, now)
  }
  if (bgmGain) {
    bgmGain.gain.cancelScheduledValues(now)
    bgmGain.gain.setValueAtTime(muted ? 0 : BGM_BASE_GAIN, now)
  }
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
  const ctx = audioCtx
  const now = ctx?.currentTime ?? 0
  if (sfxGain) {
    sfxGain.gain.cancelScheduledValues(now)
    sfxGain.gain.setTargetAtTime(value ? 0 : SFX_BASE_GAIN, now, 0.02)
  }
  if (bgmGain) {
    bgmGain.gain.cancelScheduledValues(now)
    bgmGain.gain.setTargetAtTime(value ? 0 : BGM_BASE_GAIN, now, 0.02)
  }
}

/**
 * BGM・SEの両方を一瞬だけ弱める（100%到達時の静寂演出、大きいCOMBO BREAK時の「怯み」に使う）。
 * durationMsかけて元の音量に戻る。depthは0〜1（1=ほぼ無音まで、0.5=半分まで）。
 *
 * ランプを「下げてすぐ戻す」形にすると、durationMsの大半がすでに音量回復中になってしまい、
 * 「静寂」に聞こえる時間がほぼ無くなる。そのため、下げた後は一定時間そのレベルを保持し、
 * durationMsの終わり際だけ素早く元の音量へ戻す（ホールド→リカバリー）形にしている。
 */
export function duckAudio(durationMs: number, depth = 1): void {
  const ctx = audioCtx
  if (!ctx) return
  const now = ctx.currentTime
  const downMs = Math.min(40, durationMs * 0.15)
  const recoverMs = Math.min(80, durationMs * 0.25)
  const holdUntil = now + Math.max(downMs, durationMs - recoverMs) / 1000
  const endAt = now + durationMs / 1000
  const targets: [GainNode | null, number][] = [
    [sfxGain, muted ? 0 : SFX_BASE_GAIN],
    [bgmGain, muted ? 0 : BGM_BASE_GAIN],
  ]
  for (const [node, base] of targets) {
    if (!node) continue
    const duckedTo = Math.max(0.0001, base * (1 - depth))
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(duckedTo, now + downMs / 1000)
    node.gain.setValueAtTime(duckedTo, holdUntil)
    node.gain.linearRampToValueAtTime(base, endAt)
  }
}
