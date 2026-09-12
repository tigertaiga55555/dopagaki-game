import { GAME_CONFIG } from '../config/gameConfig'
import {
  CRASH_MESSAGES,
  FAKE_BONUS_ANNOUNCE,
  FAKE_BONUS_COUNTDOWN_LABEL,
  FAKE_BONUS_DROP_MESSAGES,
  FAKE_BONUS_NOTHING_MESSAGES,
  FAKE_BONUS_WIN_MESSAGES,
  FLAT_BONUS_MESSAGES,
  MYSTERY_COUNTDOWN_LABEL,
  MYSTERY_RESOLVE_MESSAGES,
  RECOVER_MESSAGES,
  SPIKE_MESSAGES,
} from '../config/messages'
import { pick, randFloat, randInt, weightedPick } from './random'
import type { GameStep } from '../types'

const { timing, events, pointHardCap, amplitudeCap } = GAME_CONFIG

function clampPoint(value: number): number {
  return Math.max(1, Math.min(pointHardCap, Math.round(value)))
}

/**
 * 上昇系イベントは「基準値（amplitude）」に対する比率を加算する方式にしている。
 * 現在ポイントへの倍率で増やすと複利で指数爆発し、ランク上限が意味をなさなくなるため。
 * amplitude はゲーム進行度に応じて緩やかに大きくなる値（timeline.ts で計算）。
 *
 * さらに、現在ポイントが amplitudeCap に近い/超えているほど上昇量を弱める
 * （headroom）。これが無いと複数ステップの上昇イベントを繰り返すだけで
 * 際限なく積み上がってしまうため、ランク上限付近で自然に伸びが鈍る「頭打ち感」を出す。
 */
function headroom(point: number): number {
  return Math.max(0.15, 1 - point / amplitudeCap)
}

function riseDelta(point: number, amplitude: number, ratioMin: number, ratioMax: number): number {
  return amplitude * randFloat(ratioMin, ratioMax) * headroom(point)
}

/** 通常上昇：数ステップかけてじわっと増える */
export function riseNormal(current: number, amplitude: number): GameStep[] {
  const steps = randInt(2, 3)
  const out: GameStep[] = []
  let point = current
  for (let i = 0; i < steps; i++) {
    point = clampPoint(point + riseDelta(point, amplitude, events.riseNormal.ratioMin, events.riseNormal.ratioMax))
    out.push({ point, duration: timing.riseStep })
  }
  return out
}

/** 急上昇：一気に跳ね上がる */
export function riseBig(current: number, amplitude: number): GameStep[] {
  const point = clampPoint(current + riseDelta(current, amplitude, events.riseBig.ratioMin, events.riseBig.ratioMax))
  return [{ point, duration: timing.bigStep, message: pick(SPIKE_MESSAGES), effect: 'spike' }]
}

/** 暴落：今持っている分の大部分を一気に失う */
export function crash(current: number, isFirst: boolean): GameStep[] {
  const point = clampPoint(current * randFloat(events.crash.min, events.crash.max))
  return [
    {
      point,
      duration: timing.bigStep,
      message: pick(CRASH_MESSAGES),
      effect: 'crash',
      isFirstCrash: isFirst,
    },
  ]
}

/** じわじわ下落：複数ステップで少しずつ下がる */
export function crashSlow(current: number): GameStep[] {
  const { stepMin, stepMax, steps } = events.crashSlow
  const out: GameStep[] = []
  let point = current
  for (let i = 0; i < steps; i++) {
    point = clampPoint(point * randFloat(stepMin, stepMax))
    out.push({
      point,
      duration: timing.riseStep,
      effect: i === 0 ? 'crash' : undefined,
    })
  }
  return out
}

/** 停滞：ほぼ変わらない小さな変化を繰り返す */
export function plateau(current: number): GameStep[] {
  const steps = randInt(3, 4)
  const out: GameStep[] = []
  let point = current
  for (let i = 0; i < steps; i++) {
    point = clampPoint(point + randInt(-2, 3))
    out.push({ point, duration: timing.plateauStep })
  }
  return out
}

/** 暴落からの復活：大きく落ちてから盛り返す */
export function crashRecover(current: number, amplitude: number): GameStep[] {
  const out = crash(current, false)
  let point = out[0].point
  const { ratioMin, ratioMax, steps } = events.crashRecoverUp
  for (let i = 0; i < steps; i++) {
    point = clampPoint(point + riseDelta(point, amplitude, ratioMin, ratioMax))
    out.push({
      point,
      duration: timing.bigStep,
      message: i === steps - 1 ? pick(RECOVER_MESSAGES) : undefined,
      effect: i === steps - 1 ? 'recover' : undefined,
    })
  }
  return out
}

/** フェイクピーク：ピークに見せかけて僅かな上下で足踏みする */
export function fakePeak(current: number, amplitude: number): GameStep[] {
  const out: GameStep[] = []
  let point = current
  const bigSteps = randInt(2, 3)
  for (let i = 0; i < bigSteps; i++) {
    point = clampPoint(point + riseDelta(point, amplitude, events.fakePeak.ratioMin, events.fakePeak.ratioMax))
    out.push({ point, duration: timing.riseStep })
  }
  point = clampPoint(point + 1)
  out.push({ point, duration: timing.plateauStep })
  point = clampPoint(point + 1)
  out.push({ point, duration: timing.plateauStep, message: 'ここが天井……？' })
  return out
}

/** 急激なインフレ：畳み掛けるように何段も伸びる */
export function inflation(current: number, amplitude: number): GameStep[] {
  const { ratioMin, ratioMax, steps } = events.inflation
  const out: GameStep[] = []
  let point = current
  for (let i = 0; i < steps; i++) {
    point = clampPoint(point + riseDelta(point, amplitude, ratioMin, ratioMax))
    out.push({
      point,
      duration: timing.bigStep,
      message: i === steps - 1 ? pick(SPIKE_MESSAGES) : undefined,
      effect: i === steps - 1 ? 'spike' : undefined,
    })
  }
  return out
}

/** 期間限定風フラットボーナス */
export function flatBonus(current: number, amplitude: number): GameStep[] {
  const { ratioMin, ratioMax, minPoints } = events.flatBonus
  const bonus = Math.max(minPoints, Math.round(riseDelta(current, amplitude, ratioMin, ratioMax)))
  const point = clampPoint(current + bonus)
  return [{ point, duration: timing.bigStep, message: pick(FLAT_BONUS_MESSAGES), effect: 'bonus' }]
}

/** フェイクボーナスイベント：カウントダウン演出→当たり/はずれ/逆に下落 */
export function fakeBonus(current: number): GameStep[] {
  const out: GameStep[] = [
    { point: current, duration: 700, message: pick(FAKE_BONUS_ANNOUNCE), effect: 'fakeAnnounce' },
    { point: current, duration: 250, message: FAKE_BONUS_COUNTDOWN_LABEL },
    { point: current, duration: timing.countdownStep, message: '3' },
    { point: current, duration: timing.countdownStep, message: '2' },
    { point: current, duration: timing.countdownStep, message: '1' },
  ]

  const outcome = weightedPick({
    double: events.fakeBonus.doubleWeight,
    nothing: events.fakeBonus.nothingWeight,
    drop: events.fakeBonus.dropWeight,
  })

  if (outcome === 'double') {
    out.push({
      point: clampPoint(current * 2),
      duration: timing.resolveStep,
      message: pick(FAKE_BONUS_WIN_MESSAGES),
      effect: 'fakeReveal',
    })
  } else if (outcome === 'drop') {
    const { dropMin, dropMax } = events.fakeBonus
    out.push({
      point: clampPoint(current * randFloat(dropMin, dropMax)),
      duration: timing.resolveStep,
      message: pick(FAKE_BONUS_DROP_MESSAGES),
      effect: 'crash',
    })
  } else {
    out.push({
      point: current,
      duration: timing.resolveStep,
      message: pick(FAKE_BONUS_NOTHING_MESSAGES),
      effect: 'fakeReveal',
    })
  }

  return out
}

/** 謎のカウントダウン：何が起きるか説明せず、実際には何も起きない緊張演出 */
export function mysteryCountdown(current: number): GameStep[] {
  return [
    { point: current, duration: 250, message: MYSTERY_COUNTDOWN_LABEL, effect: 'fakeAnnounce' },
    { point: current, duration: timing.countdownStep, message: '2' },
    { point: current, duration: timing.countdownStep, message: '1' },
    { point: current, duration: timing.resolveStep, message: pick(MYSTERY_RESOLVE_MESSAGES) },
  ]
}
