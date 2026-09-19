import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { colorSymbol, COLOR_SYMBOL_STYLE } from './colorSymbols'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * バッジの出現枠（固定8箇所）。以前は6箇所だったが、Ver.5.0の重大バグ修正で「必須の赤は
 * 自動despawnさせない」方式に変更したため、必須赤（最大5個）が同時に未タップのまま残っても
 * ノイズ用の空き枠を確保できるよう2枠増やした。DOM無限生成を防ぐ上限の役割も兼ねる。
 */
const SLOTS = [
  { x: 15, y: 20 },
  { x: 38, y: 20 },
  { x: 62, y: 20 },
  { x: 85, y: 20 },
  { x: 15, y: 62 },
  { x: 38, y: 62 },
  { x: 62, y: 62 },
  { x: 85, y: 62 },
]

const RED_HEX = '#ef4444'
const OTHER_COLORS = [
  { id: 'blue', hex: '#3b82f6' },
  { id: 'green', hex: '#22c55e' },
]

interface Badge {
  id: number
  slotIndex: number
  isTarget: boolean
  hex: string
  colorId: string
}

/**
 * 「赤だけ消せ！」：通知バッジが次々出現する。赤だけタップして規定数消せば成功、赤以外は即MISS。
 *
 * Ver.5.0追加修正（重大バグ修正）：実機プレイで「必要数（4〜5個）の赤が全部出現する前に
 * 問題のtimeoutが先に発火してMISSになる」という、プレイヤーの操作ミスに一切起因しない
 * 不可能問題が発生していた。
 *
 * 原因は2つの構造的欠陥の組み合わせだった。
 * 1. 旧実装は「200〜350msごとに55%の確率で赤を1個出現させる」という純粋な確率的スポーンで、
 *    出現数・出現タイミングに一切の保証がなかった。運が悪いと必要数の赤が集まるまでに
 *    大きく時間がかかり得るにもかかわらず、外側のtimeoutは固定（または直前の1個成功ごとに
 *    「残り数×perRedMs」で引き直すだけ）だったため、「タップは全て正しく最速で行っていたのに、
 *    赤自体がその時点でまだ出現していなかった」というケースでtimeoutが先に来ることがあった。
 * 2. 出現枠（旧6箇所）が埋まっている間はスポーン試行そのものが黙って無効になる仕組みだった
 *    ため、非対象バッジが枠を埋め続けると赤の出現がさらに遅れる悪化要因になっていた。
 *
 * 修正方針（このコメント内で完結させず、下記の各関数実装も参照）：
 * - 問題開始時（Component mount時、実際に確定したspec.targetTimeMsを使って）に、必要数ぶんの
 *   赤の出現タイミングを先に全て確定させる（buildRequiredRedDelays）。最後の赤の出現時刻は
 *   必ず「timeout − 人間の最低反応猶予（TIMING_SAFETY.notifRush.reactionBufferMs）」以下に
 *   なることを区間分割で構造的に保証し、かつ数値的にも明示的にクランプする。
 * - 前半〜中盤にも適度に分散させ、後半に偏った出現や「5個目が土壇場で出現する」ことを防ぐ
 *   （targetRedCount等分した各区間内でランダムに1個ずつ配置）。
 * - 必須の赤バッジは自動despawn（lifespan経過での消滅）させない。ノイズ（非対象）だけが
 *   従来通りlifespan経過で消える。これにより「正しく見えているのに反応が一瞬遅れて
 *   対象を見失っただけで、二度とその分の赤が来ず詰む」という別種の詰みも構造的に排除する。
 * - 出現枠が全て埋まっている状態で必須の赤の出現時刻が来た場合、最も古いノイズ（非対象）を
 *   1個強制的に退場させて枠を確保する（必須赤の出現だけは何があっても取りこぼさない）。
 * - 正解条件・不正解判定（赤以外タップ即MISS）・resolveOnce（doneRefによる二重確定防止）・
 *   SUCCESS後の全タイマークリーンアップは既存仕様のまま変更していない。
 */
function generate() {
  const targetRedCount = randInt(4, 5)
  const spawnIntervalMs = randInt(200, 350)
  const lifespanMs = randInt(950, 1250)
  return { targetRedCount, spawnIntervalMs, lifespanMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { targetRedCount } = data as { targetRedCount: number }
  return targetRedCount * TIMING_SAFETY.notifRush.perRedMs + TIMING_SAFETY.notifRush.reactionBufferMs
}

/**
 * 必須の赤targetRedCount個の出現タイミング（ms、問題開始からの相対時刻）を確定する。
 * [0, timeoutMs − reactionBufferMs] をtargetRedCount等分し、各区間内の1点をランダムに選ぶ
 * ことで「前半〜中盤にも適度に分散」かつ「最後の赤は締切以下」を同時に満たす。
 * 区間分割で数学的に単調増加になるが、丸め誤差に備えて最後の1個は明示的にもクランプする。
 */
function buildRequiredRedDelays(targetRedCount: number, timeoutMs: number): number[] {
  const lastRedDeadlineMs = Math.max(0, timeoutMs - TIMING_SAFETY.notifRush.reactionBufferMs)
  const delays: number[] = []
  for (let i = 0; i < targetRedCount; i++) {
    const segStart = Math.round((lastRedDeadlineMs * i) / targetRedCount)
    const segEnd = Math.round((lastRedDeadlineMs * (i + 1)) / targetRedCount)
    delays.push(randInt(segStart, Math.max(segStart, segEnd)))
  }
  delays.sort((a, b) => a - b)
  if (delays.length > 0) {
    delays[delays.length - 1] = Math.min(delays[delays.length - 1], lastRedDeadlineMs)
  }
  return delays
}

/**
 * 視覚的な密度（既存の「次々出現する通知」の忙しさ）を保つためのノイズ（非対象）出現タイミング。
 * 旧実装は「spawnIntervalMsごとに55%の確率で赤・45%で非対象」だったため、非対象の実質的な
 * 平均間隔はspawnIntervalMs/0.45だった。同じ体感密度になるようその間隔を踏襲する
 * （勝敗条件には一切関与しないため、多少前後してもゲームの解けやすさには影響しない）。
 */
function buildNoiseDelays(spawnIntervalMs: number, timeoutMs: number): number[] {
  const noiseIntervalMs = Math.round(spawnIntervalMs / 0.45)
  const delays: number[] = []
  let cursor = randInt(Math.round(noiseIntervalMs * 0.5), noiseIntervalMs)
  while (cursor < timeoutMs - 150) {
    delays.push(cursor)
    cursor += randInt(Math.round(noiseIntervalMs * 0.7), Math.round(noiseIntervalMs * 1.3))
  }
  return delays
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { targetRedCount, spawnIntervalMs, lifespanMs } = spec.data as {
    targetRedCount: number
    spawnIntervalMs: number
    lifespanMs: number
  }
  const [badges, setBadges] = useState<Badge[]>([])
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const clearedRedRef = useRef(0)
  const badgeIdRef = useRef(0)
  const spawnTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const despawnTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** slotIndex -> 現在の占有バッジ情報。必須赤が枠不足で取りこぼされないための強制退場判定に使う。 */
  const slotOccupantsRef = useRef<Map<number, { id: number; isTarget: boolean }>>(new Map())

  useEffect(() => {
    function removeBadge(id: number) {
      const t = despawnTimersRef.current.get(id)
      if (t) {
        clearTimeout(t)
        despawnTimersRef.current.delete(id)
      }
      for (const [slot, occ] of slotOccupantsRef.current) {
        if (occ.id === id) slotOccupantsRef.current.delete(slot)
      }
      setBadges((prev) => prev.filter((b) => b.id !== id))
    }

    function spawnBadge(isTarget: boolean) {
      if (doneRef.current) return
      const occupied = new Set(slotOccupantsRef.current.keys())
      let freeSlots = SLOTS.map((_, i) => i).filter((i) => !occupied.has(i))
      if (freeSlots.length === 0) {
        // ノイズは枠が埋まっていれば単に諦める（見た目の密度調整用途のみで勝敗に無関係）。
        if (!isTarget) return
        // 必須の赤だけは絶対に取りこぼさない：最も古い非対象バッジを1個だけ強制退場させる。
        let evictSlot: number | null = null
        for (const [slot, occ] of slotOccupantsRef.current) {
          if (!occ.isTarget) {
            evictSlot = slot
            break
          }
        }
        if (evictSlot === null) return // SLOTS(8) > 必須赤の最大数(5)のため理論上到達しない
        removeBadge(slotOccupantsRef.current.get(evictSlot)!.id)
        freeSlots = [evictSlot]
      }
      const slotIndex = freeSlots[randInt(0, freeSlots.length - 1)]
      const id = badgeIdRef.current++
      const color = isTarget ? { id: 'red', hex: RED_HEX } : OTHER_COLORS[randInt(0, OTHER_COLORS.length - 1)]
      slotOccupantsRef.current.set(slotIndex, { id, isTarget })
      if (isTarget) sfx.notifSpawn()
      setBadges((prev) => [...prev, { id, slotIndex, isTarget, hex: color.hex, colorId: color.id }])
      // 必須の赤はlifespanで自動despawnしない（見失っただけで詰む事故を構造的に排除する）。
      if (!isTarget) {
        despawnTimersRef.current.set(
          id,
          setTimeout(() => removeBadge(id), lifespanMs),
        )
      }
    }

    buildRequiredRedDelays(targetRedCount, spec.targetTimeMs).forEach((delay) => {
      spawnTimersRef.current.push(setTimeout(() => spawnBadge(true), delay))
    })
    buildNoiseDelays(spawnIntervalMs, spec.targetTimeMs).forEach((delay) => {
      spawnTimersRef.current.push(setTimeout(() => spawnBadge(false), delay))
    })

    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)

    return () => {
      spawnTimersRef.current.forEach(clearTimeout)
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      despawnTimersRef.current.forEach((t) => clearTimeout(t))
      despawnTimersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    spawnTimersRef.current.forEach(clearTimeout)
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    despawnTimersRef.current.forEach((t) => clearTimeout(t))
    despawnTimersRef.current.clear()
    onResult({
      correct,
      reactionMs: performance.now() - startRef.current,
      meta: { targetsCleared: clearedRedRef.current, targetsTotal: targetRedCount },
    })
  }

  function handleTap(badge: Badge) {
    if (doneRef.current) return
    if (!badge.isTarget) {
      finish(false)
      return
    }
    for (const [slot, occ] of slotOccupantsRef.current) {
      if (occ.id === badge.id) slotOccupantsRef.current.delete(slot)
    }
    setBadges((prev) => prev.filter((b) => b.id !== badge.id))
    clearedRedRef.current += 1
    sfx.notifPop()
    if (clearedRedRef.current >= targetRedCount) {
      finish(true)
    }
    // 必須の赤は開始時点で全て出現タイミングが確定済み（最後の1個もtimeoutの十分前に
    // 出現することが保証されている）ため、成功のたびに外側timeoutを引き直す必要はない。
  }

  return (
    <QuestionShell sub={`赤 ${clearedRedRef.current}/${targetRedCount}`} instruction={`赤（${colorSymbol('red')}）だけ消せ！`}>
      <div className="relative h-64 w-full max-w-xs">
        {badges.map((badge) => (
          <button
            key={badge.id}
            onPointerDown={() => handleTap(badge)}
            style={{ left: `${SLOTS[badge.slotIndex].x}%`, top: `${SLOTS[badge.slotIndex].y}%`, backgroundColor: badge.hex }}
            className="anim-pop absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xl active:scale-90"
          >
            <span style={COLOR_SYMBOL_STYLE}>{colorSymbol(badge.colorId)}</span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const NotifRushQuestionModule: QuestionModule = {
  id: 'notifRush',
  category: 'sorting',
  baseTargetTimeMs: 2800,
  generate,
  Component,
  computeMinTargetTimeMs,
}
