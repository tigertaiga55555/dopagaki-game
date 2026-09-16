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

/** 短い周波数スイープ音（上昇/下降）を1つ鳴らす。beep()と違い周波数自体が滑らかに動く。 */
function sweep(fromFreq: number, toFreq: number, durationMs: number, type: OscillatorType = 'sine', gainValue = 0.14) {
  if (isMuted()) return
  const ctx = getAudioContext()
  const gainOut = getSfxGain()
  if (!ctx || !gainOut) return
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  const now = ctx.currentTime
  osc.frequency.setValueAtTime(fromFreq, now)
  osc.frequency.exponentialRampToValueAtTime(toFreq, now + durationMs / 1000)
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

let sfxNoiseBuffer: AudioBuffer | null = null
function getSfxNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!sfxNoiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 0.4)
    sfxNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = sfxNoiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return sfxNoiseBuffer
}

/**
 * Ver.5.0追加: フィルタ済みノイズバースト。ガラス・金属が砕けるような質感のSEに使う
 * （bgm.tsのplayFinalMetal等と同じ発想だが、こちらはSFXバス経由）。
 */
function noiseBurst(freq: number, q: number, durationMs: number, gainValue: number, filterType: BiquadFilterType = 'bandpass') {
  if (isMuted()) return
  const ctx = getAudioContext()
  const gainOut = getSfxGain()
  if (!ctx || !gainOut) return
  if (ctx.state === 'suspended') void ctx.resume()
  const src = ctx.createBufferSource()
  src.buffer = getSfxNoiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = ctx.createGain()
  const now = ctx.currentTime
  gain.gain.setValueAtTime(gainValue, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(gainOut)
  src.start(now)
  src.stop(now + durationMs / 1000 + 0.02)
  src.onended = () => {
    src.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}

/**
 * Ver.4.11: 120% PERFECT CLEAR専用のオリジナル勝利ファンファーレ。既存作品のメロディは
 * 一切模倣せず、「短い上昇音（テッ）→明るいメジャーコード（テレーン！）→bell/sparkleの
 * 余韻」の3部構成で作る。低音impact＋brass風sawtoothのコード＋sine/triangleのベル成分を
 * 組み合わせたオリジナル構成。overdriveMax（衝撃SE）と同時に鳴らすことを想定し、
 * こちらは「祝福感」だけを担当する。
 */
function victoryFanfare() {
  // 1. 短い上昇プレップ音（テッ）
  sweep(420, 880, 140, 'triangle', 0.13)
  // 2. 明るいメジャーコード（テレーン！）：低音impact＋brass風コード＋sine上音
  setTimeout(() => {
    beep(98, 380, 'sine', 0.22)
    beep(523.25, 420, 'sawtooth', 0.1)
    beep(659.25, 420, 'sawtooth', 0.09)
    beep(784.0, 420, 'sawtooth', 0.09)
    beep(1046.5, 460, 'sine', 0.1)
  }, 150)
  // 3. bell / sparkleの余韻（高次倍音を少しずつ遅らせて鳴らし、自然な余韻を作る）
  setTimeout(() => beep(1568.0, 500, 'sine', 0.08), 380)
  setTimeout(() => beep(1975.5, 550, 'sine', 0.07), 460)
  setTimeout(() => beep(2349.3, 650, 'sine', 0.06), 560)
  setTimeout(() => beep(3136.0, 700, 'triangle', 0.05), 680)
}

/**
 * Ver.5.0追加: FINAL DOPA TRIAL突入専用のオリジナルSE、再設計版。
 *
 * 格付け：通常 < FINAL問題正解 < 100%OVERDRIVE(overdriveMax) < 120%FINAL突入(この関数)
 * < 200%PERFECT CLEAR(perfectFanfare200)。overdriveMaxより明確に強いが、祝福（major chord等）
 * は一切使わず、あくまで「異常事態・最終フェーズ解禁・ラスボス戦開始」の感触にする。
 *
 * 呼び出し側（FinalTrialScreen）は、この関数を「既存BGMのduckが明けた直後」に呼ぶこと
 * （duckAudioと同時に呼ぶと、この関数自身の音までダッキングされてしまうため）。
 *
 * レイヤー構成（すべてWeb Audio APIでのオリジナル生成。既存作品の旋律・効果音は模倣しない）：
 * 1. reverse swell風の二重スイープ（低→高、歪んだ上昇）
 * 2. 超低音SUB IMPACT「ドン！！！！」（overdriveMaxの低音impactより明確に重い）
 * 3. metallic / glass fracture（フィルタ済みノイズ＋非整数倍音の金属ヒット）
 * 4. 高音の持続的な「キィィィン」という耳鳴り・異常音
 * 5. プリズム系sparkleの降下
 * 6. 低いsub bassの残響（この直後にFINAL専用BGMがドロップする前提の橋渡し）
 */
function finalEntry() {
  // 1. reverse swell（二重スイープで厚みを出す。祝福ではなく警告の上昇感）
  sweep(80, 1800, 340, 'sawtooth', 0.16)
  sweep(120, 2200, 340, 'square', 0.07)
  // 2. 超低音SUB IMPACT（overdriveMaxの低音impact=0.2よりも明確に強く、より低い）
  setTimeout(() => {
    beep(34, 560, 'sine', 0.32)
    beep(51, 440, 'sine', 0.22)
  }, 320)
  // 3. metallic / glass fracture（金属・ガラス・黄金UIが砕ける質感）
  setTimeout(() => {
    noiseBurst(3200, 6, 220, 0.17)
    noiseBurst(5200, 9, 160, 0.11)
    beep(1830, 110, 'square', 0.11)
    beep(2540, 90, 'square', 0.09)
    beep(3370, 80, 'square', 0.07)
    beep(4460, 70, 'square', 0.05)
  }, 340)
  // 4. 高音の「キィィィン」という耳鳴り・異常感（2音をわずかにデチューンして唸らせる）
  setTimeout(() => {
    beep(4200, 640, 'sine', 0.09)
    beep(4222, 640, 'triangle', 0.05)
  }, 380)
  // 5. プリズム系sparkleが降りてくる
  setTimeout(() => beep(3100, 260, 'sine', 0.07), 480)
  setTimeout(() => beep(2600, 240, 'sine', 0.06), 580)
  setTimeout(() => beep(3800, 300, 'triangle', 0.05), 650)
  // 6. 低いsub bassの残響（FINAL専用BGM DROPへの橋渡し）
  setTimeout(() => beep(34, 480, 'sine', 0.17), 700)
}

/**
 * Ver.5.0: FINAL DOPA TRIAL中、1問正解するたびに鳴る成功SE。intensity（1〜5）が
 * 上がるほど音域・レイヤー数が増え、Q1→Q15に向けて確実に「盛り上がっていく」ようにする
 * （17. 成功演出の強度をQ1-3/Q4/Q5-7/Q8/Q9-11/Q12/Q13/Q14/Q15で段階的にエスカレートさせる）。
 */
function finalSuccess(intensity: 1 | 2 | 3 | 4 | 5) {
  const base = 1000 + intensity * 120
  beep(base, 90, 'triangle', 0.11 + intensity * 0.012)
  setTimeout(() => beep(base * 1.5, 110, 'sine', 0.1 + intensity * 0.012), 60)
  if (intensity >= 2) setTimeout(() => beep(base * 2, 120, 'sine', 0.09), 130)
  if (intensity >= 3) beep(70, 180, 'sine', 0.1 + intensity * 0.01)
  if (intensity >= 4) setTimeout(() => beep(base * 2.5, 140, 'triangle', 0.08), 190)
  if (intensity >= 5) setTimeout(() => beep(base * 3, 160, 'sine', 0.07), 250)
}

/**
 * Ver.5.0: FINAL DOPA TRIAL失敗（TRIAL FAILED）専用SE。通常のMISS音より重く、
 * 「積み上げてきたものが崩れ落ちる」ような下降トーンにする。
 */
function finalMiss() {
  sweep(900, 120, 320, 'sawtooth', 0.14)
  setTimeout(() => beep(90, 400, 'sine', 0.16), 200)
}

/**
 * Ver.5.0追加: 200% 真のPERFECT CLEAR専用の超大型ファンファーレ、再設計版。
 * TASK C「ゲーム史上最大の脳汁」の中核。C-8で示された8部構成を明示的に実装する：
 * 1. 上昇する短い3〜5音の駆け上がり
 * 2. 巨大なmajor chord
 * 3. brass風synth（2と同時に重ねる）
 * 4. sub impact（1と同時、ドォォォン！の芯）
 * 5. bell
 * 6. sparkle
 * 7. さらに上へ行く短い勝利フレーズ
 * 8. 最後に長い明るいコード
 * 音を一度に全部鳴らさず、約3秒かけて祝福が段階的に広がるようにする。
 * 既存の120%時代のvictoryFanfare()を内部の一部として引き続き活用しつつ、
 * それを大きく上回るレイヤー数・音域・長さにする（46. 完全オリジナル構成、
 * 既存作品の旋律は一切模倣しない）。
 */
function perfectFanfare200() {
  // 1. 上昇する短い4音の駆け上がり（テッテレレ、の出だし）
  ;[440, 587.33, 698.46, 880].forEach((freq, i) => {
    setTimeout(() => beep(freq, 110, 'triangle', 0.12), i * 55)
  })
  // 4. sub impact（1と同時に響かせる、200%到達の重みを一発目に叩き込む）
  beep(40, 560, 'sine', 0.3)
  setTimeout(() => beep(56, 460, 'sine', 0.22), 30)
  // 2〜3. 巨大なmajor chord＋brass風synth（既存のvictoryFanfare()の構成をそのまま内包しつつ、
  // さらに低音を1オクターブ下に重ねて厚みを出す）
  setTimeout(() => {
    victoryFanfare()
    beep(130.81, 460, 'sawtooth', 0.09)
    beep(196.0, 460, 'sawtooth', 0.08)
  }, 260)
  // 5. bell（既存victoryFanfare内のbell/sparkleより高次・長めの層を追加で重ねる）
  setTimeout(() => beep(2093.0, 700, 'sine', 0.07), 560)
  setTimeout(() => beep(2637.0, 750, 'sine', 0.06), 660)
  // 6. sparkle（きらめきが降りてくる）
  setTimeout(() => beep(3520.0, 400, 'triangle', 0.05), 780)
  setTimeout(() => beep(4186.0, 420, 'sine', 0.04), 880)
  // 7. さらに上へ行く短い勝利フレーズ（駆け上がる4音、1.より広い音域で「もう一段上」を表現）
  setTimeout(() => {
    ;[784, 987.77, 1174.66, 1567.98, 1975.5].forEach((freq, i) => {
      setTimeout(() => beep(freq, 140, 'triangle', 0.1), i * 65)
    })
  }, 1000)
  // 8. 最後に長い明るいコード（ルート＋3度＋5度＋オクターブを長く伸ばして余韻を作る）
  setTimeout(() => {
    beep(261.63, 1800, 'sine', 0.09)
    beep(329.63, 1700, 'triangle', 0.07)
    beep(392.0, 1650, 'sine', 0.07)
    beep(523.25, 1500, 'triangle', 0.06)
  }, 1450)
}

/** Ver.5.0追加: 200% CLEAR演出の花火に合わせて鳴らす「ドン！」という低い爆発音。 */
function fireworkBoom() {
  beep(60, 220, 'sine', 0.16)
  noiseBurst(1200, 3, 180, 0.09, 'bandpass')
  setTimeout(() => beep(1800, 90, 'sine', 0.05), 40)
}

/**
 * Ver.5.0追加: 200%結果画面が表示された瞬間だけ鳴らす、ごく控えめな余韻チャイム（C-12）。
 * 演出終了→結果画面で完全無音にしないための、bell/sparkle/victory chordの短い名残。
 */
function resultChime200() {
  beep(1568.0, 500, 'sine', 0.06)
  setTimeout(() => beep(2093.0, 550, 'sine', 0.05), 120)
  setTimeout(() => beep(523.25, 900, 'triangle', 0.04), 200)
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
  /** Ver.4.7: 120%到達専用の爆発SE。100%到達より一段大きく、低音の衝撃＋金色のきらめきを重ねる */
  overdriveMax: () => {
    beep(70, 260, 'sine', 0.2)
    beep(1800, 140, 'sine', 0.14)
    setTimeout(() => beep(2200, 200, 'sine', 0.13), 100)
    setTimeout(() => beep(2800, 220, 'triangle', 0.11), 200)
    setTimeout(() => beep(3400, 280, 'sine', 0.09), 320)
  },
  /** Ver.4.11: 120% PERFECT CLEAR専用のオリジナル勝利ファンファーレ（overdriveMaxの直後に鳴らす） */
  victoryFanfare,
  /** Ver.5.0: FINAL DOPA TRIAL突入専用SE（祝福ではなく警告・ボス戦突入の感触） */
  finalEntry,
  /** Ver.5.0: FINAL DOPA TRIAL、1問正解ごとの成功SE（intensity 1〜5で段階的に派手になる） */
  finalSuccess,
  /** Ver.5.0: FINAL DOPA TRIAL失敗（TRIAL FAILED）専用SE */
  finalMiss,
  /** Ver.5.0: 200% 真のPERFECT CLEAR専用の超大型ファンファーレ（ゲーム最大の演出） */
  perfectFanfare200,
  /** Ver.5.0追加: 200% CLEAR演出の花火に合わせて鳴らす「ドン！」 */
  fireworkBoom,
  /** Ver.5.0追加: 200%結果画面表示時のごく控えめな余韻チャイム */
  resultChime200,
  /** GOまで押すな：GO表示の合図音 */
  go: () => beep(1300, 70, 'sine', 0.1),
  /**
   * Ver.4.8: STARTボタン押下時の「起動感のある短いSE」。低音の「ドン！」＋わずかに高い
   * パンチ音を重ね、AudioContextのアンロックジェスチャーと同じ同期コールバック内で鳴らす。
   */
  startPress: () => {
    beep(75, 220, 'sine', 0.22)
    setTimeout(() => beep(340, 100, 'square', 0.12), 20)
  },
  /** Ver.4.8: 3・2・1のあと、GO！の瞬間だけ鳴らす強めの開始音（countdownBeepより一段大きく派手） */
  gameStart: () => {
    beep(2200, 160, 'square', 0.22)
    setTimeout(() => beep(1400, 200, 'sine', 0.16), 40)
    setTimeout(() => beep(2800, 180, 'triangle', 0.12), 90)
  },
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
  /** Ver.4.8「DOPA BONUS TIME」：タップごとに鳴る音。タップ数が増えるほど音程が上がる。10/20HITで一段強く。 */
  bonusTap: (hitCount: number) => {
    const pitchMul = 1 + Math.min(hitCount, 24) * 0.03
    if (hitCount > 0 && hitCount % 10 === 0) {
      beep(1200 * pitchMul, 90, 'triangle', 0.13)
      setTimeout(() => beep(1700 * pitchMul, 100, 'sine', 0.11), 50)
    } else {
      beep(850 * pitchMul, 45, 'square', 0.07)
    }
  },
  /** Ver.4.8「DOPA BONUS TIME」：終了時の「DOPA BOOST！」専用SE。派手で強めでよい。 */
  bonusBoost: () => {
    beep(90, 220, 'sine', 0.2)
    beep(1500, 130, 'sawtooth', 0.15)
    setTimeout(() => beep(2000, 160, 'sine', 0.13), 70)
    setTimeout(() => beep(2500, 200, 'triangle', 0.1), 150)
  },
}
