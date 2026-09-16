import { useEffect, useRef, useState } from 'react'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, randInt, shuffle } from '../../engine/random'
import { sfx } from '../../utils/sound'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q16（FINAL QUESTION＝専用ラスボス）：全面再設計版・5宝箱の黄金追跡。
 *
 * 旧版（4箱・複数色のボール・シャッフル後にランダムな色を質問）は実機で
 * 「何がどの箱へ移動したか分かりにくい」「追跡対象が多すぎて難しすぎる」という
 * 問題があったため廃止。新版は「5つの宝箱のうち黄金の宝が入った1つだけを最後まで
 * 追う」というシンプルな目的に絞り、難しさは追跡対象の数ではなく宝箱そのものの
 * モーション（弧・波・S字・回転・同時交差など）で作る。
 *
 * 内部設計：boxId（0〜4固定）とgoldChestId（1つだけ）は生成時に一度だけ確定し、以後不変。
 * シャッフルはslotToBox（スロット→boxId）だけを動かす……のではなく、今回はさらに一歩進めて
 * 「各宝箱を表すDOM要素をboxIdでキーした固定要素にし、その要素自身の画面位置を直接動かす」
 * 設計にした。これにより判定（tap）は常にその物理要素が持つboxIdをそのまま見るだけでよく、
 * 「内部stateと画面表示の食い違い」が構造的に起こり得ない（slotToBox経由の逆引きが一切不要）。
 * slotToBox配列はアニメーションの再生（どの宝箱がどの向きに動くか）を計算するためだけに使う。
 */

const SLOT_COUNT = 5
/** 5宝箱を五角形状に配置する角度（度）。slot0を真上にして時計回り。 */
const SLOT_ANGLES = [270, 342, 54, 126, 198] as const
const CENTER = { x: 50, y: 47 }
const RADIUS_X = 29
const RADIUS_Y = 32

function angleToPos(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CENTER.x + RADIUS_X * Math.cos(rad), y: CENTER.y + RADIUS_Y * Math.sin(rad) }
}
const SLOT_POSITIONS = SLOT_ANGLES.map(angleToPos)

type SwapStyle = 'arc' | 'wave' | 'sCurve'
type AtomicMove =
  | { kind: 'swap'; a: number; b: number; style: SwapStyle }
  | { kind: 'rotate3'; slots: [number, number, number]; dir: 1 | -1; longWay: boolean }
  | { kind: 'rotate5'; dir: 1 | -1; longWay: boolean }

interface ShuffleStep {
  moves: AtomicMove[]
  durationMs: number
}

function applyAtomicMove(slotToBox: number[], move: AtomicMove): number[] {
  const next = [...slotToBox]
  if (move.kind === 'swap') {
    next[move.a] = slotToBox[move.b]
    next[move.b] = slotToBox[move.a]
  } else if (move.kind === 'rotate3') {
    const [x, y, z] = move.slots
    if (move.dir === 1) {
      next[y] = slotToBox[x]
      next[z] = slotToBox[y]
      next[x] = slotToBox[z]
    } else {
      next[x] = slotToBox[y]
      next[y] = slotToBox[z]
      next[z] = slotToBox[x]
    }
  } else {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const from = move.dir === 1 ? (i + SLOT_COUNT - 1) % SLOT_COUNT : (i + 1) % SLOT_COUNT
      next[i] = slotToBox[from]
    }
  }
  return next
}

function applyStep(slotToBox: number[], step: ShuffleStep): number[] {
  return step.moves.reduce((acc, mv) => applyAtomicMove(acc, mv), slotToBox)
}

function distinctRandomSlots(count: number): number[] {
  return shuffle([0, 1, 2, 3, 4]).slice(0, count)
}

function buildSwapMove(): AtomicMove {
  const [a, b] = distinctRandomSlots(2)
  return { kind: 'swap', a, b, style: pick(['arc', 'wave', 'sCurve'] as const) }
}
function buildRotate3Move(): AtomicMove {
  const slots = distinctRandomSlots(3) as [number, number, number]
  return { kind: 'rotate3', slots, dir: pick([1, -1] as const), longWay: Math.random() < 0.25 }
}
function buildRotate5Move(): AtomicMove {
  return { kind: 'rotate5', dir: pick([1, -1] as const), longWay: Math.random() < 0.3 }
}
function buildCrossStep(): AtomicMove[] {
  const [a, b, c, d] = distinctRandomSlots(4)
  return [
    { kind: 'swap', a, b, style: pick(['arc', 'wave', 'sCurve'] as const) },
    { kind: 'swap', a: c, b: d, style: pick(['arc', 'wave', 'sCurve'] as const) },
  ]
}

function moveSignature(moves: AtomicMove[]): string {
  return moves
    .map((m) => (m.kind === 'swap' ? `swap${m.a}-${m.b}-${m.style}` : m.kind === 'rotate3' ? `r3${m.slots.join('')}${m.dir}` : `r5${m.dir}${m.longWay}`))
    .sort()
    .join('|')
}

/**
 * B-6/B-7: 単純なslot交換の繰り返しに見せず、「弧を描く交換」「三角形ローテーション」
 * 「五角形全体の回転（長い外周ルートも混ぜる）」「同時に2組が交差する」を組み合わせた
 * 固定テンプレート（型は固定・具体的なslot/向き/スタイルは毎回ランダム）。
 * rotate5が2回含まれる＝その2回だけで5箱全てが最低2回は移動することが構造的に保証され、
 * 他のステップでさらに動く（B-18: 特定の箱だけほぼ動かない、という事故を型レベルで防ぐ）。
 * B-6最後の「高速2連続移動」は最後の2ステップだけdurationMsを短くして表現する。
 */
const NORMAL_DURATION_MS = 850
const FINALE_DURATION_MS = 420
const STEP_BUILDERS: (() => AtomicMove[])[] = [
  () => [buildSwapMove()],
  () => [buildRotate3Move()],
  () => buildCrossStep(),
  () => [buildRotate5Move()],
  () => [buildSwapMove()],
  () => [buildRotate3Move()],
  () => buildCrossStep(),
  () => [buildRotate5Move()],
  () => [buildSwapMove()],
  () => [buildSwapMove()], // finale 1（高速）
  () => [buildRotate3Move()], // finale 2（高速）
]

function generateMoveSequence(): ShuffleStep[] {
  const steps: ShuffleStep[] = []
  let prevSignature = ''
  STEP_BUILDERS.forEach((build, i) => {
    let moves = build()
    let signature = moveSignature(moves)
    let retries = 0
    while (signature === prevSignature && retries < 8) {
      moves = build()
      signature = moveSignature(moves)
      retries++
    }
    const isFinale = i >= STEP_BUILDERS.length - 2
    steps.push({ moves, durationMs: isFinale ? FINALE_DURATION_MS : NORMAL_DURATION_MS })
    prevSignature = signature
  })
  return steps
}

/**
 * 生成した手順を実際にslotToBoxへ適用して最終位置を求める（検証・デバッグ用）。
 * Componentは実際にはboxId自体をアニメーションさせるため、この関数の戻り値そのものを
 * 描画には使わない。500 seed検証では、この関数で計算した「各boxIdが最終的にどのslotへ
 * 収まるか」と、Component側の再生ロジック（同じapplyStep）が同じ結果になることを確認する。
 */
export function replayFinalSlotToBox(moveSequence: ShuffleStep[]): number[] {
  let slotToBox = [0, 1, 2, 3, 4]
  for (const step of moveSequence) slotToBox = applyStep(slotToBox, step)
  return slotToBox
}

/** 各boxIdが全ステップを通じて何回スロットを移動したか（B-18の「十分動く」検証用）。 */
export function countBoxMoves(moveSequence: ShuffleStep[]): number[] {
  const counts = [0, 0, 0, 0, 0]
  let slotToBox = [0, 1, 2, 3, 4]
  for (const step of moveSequence) {
    const next = applyStep(slotToBox, step)
    for (let boxId = 0; boxId < SLOT_COUNT; boxId++) {
      if (slotToBox.indexOf(boxId) !== next.indexOf(boxId)) counts[boxId]++
    }
    slotToBox = next
  }
  return counts
}

export function generateChestShuffle() {
  const goldChestId = randInt(0, 4)
  const moveSequence = generateMoveSequence()
  return { goldChestId, moveSequence }
}

/** FINAL QUESTIONの回答フェーズには時間制限がない（39. FINAL QUESTIONは時間制限なし）。 */
function computeTargetTimeMs() {
  return 0
}

type Phase = 'goal' | 'reveal' | 'closing' | 'shuffling' | 'answer' | 'selecting' | 'opening'

const GOAL_MS = 1500
const REVEAL_MS = 2600
const CLOSING_MS = 550
const SELECT_PAUSE_MS = 450
const OPEN_CREAK_MS = 350
const CORRECT_GLOW_MS = 550
const WRONG_REVEAL_MS = 260
const WRONG_DARK_MS = 420

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** swapスタイルごとの経路計算：直線補間＋垂直方向のオフセット（arc=外向きに膨らむ、wave=上下に波打つ、sCurve=左右にうねる）。 */
function swapPathPosition(from: { x: number; y: number }, to: { x: number; y: number }, t: number, style: SwapStyle) {
  const x = lerp(from.x, to.x, t)
  const y = lerp(from.y, to.y, t)
  if (style === 'wave') {
    return { x, y: y - 10 * Math.sin(t * Math.PI) }
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  let nx = -dy / len
  let ny = dx / len
  // 常に中心から外向きに膨らむよう、法線の向きをmidpoint基準で補正する
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const outward = { x: mid.x - CENTER.x, y: mid.y - CENTER.y }
  if (nx * outward.x + ny * outward.y < 0) {
    nx = -nx
    ny = -ny
  }
  const amplitude = 9
  const offset = style === 'arc' ? Math.sin(t * Math.PI) * amplitude : Math.sin(t * 2 * Math.PI) * amplitude
  return { x: x + nx * offset, y: y + ny * offset }
}

function normalizeAngleDelta(delta: number): number {
  let d = delta % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function rotatePathPosition(fromAngle: number, toAngle: number, t: number, longWay: boolean) {
  const shortDelta = normalizeAngleDelta(toAngle - fromAngle)
  const delta = longWay ? shortDelta - 360 * Math.sign(shortDelta || 1) : shortDelta
  const angle = fromAngle + delta * t
  return angleToPos(angle)
}

function Component({ spec, onResult, autoSolveDelayMs }: FinalQuestionComponentProps) {
  const { goldChestId, moveSequence } = spec.data as { goldChestId: number; moveSequence: ShuffleStep[] }
  const [phase, setPhase] = useState<Phase>('goal')
  /**
   * boxId→現在の表示位置。シャッフル中はここを更新せず、boxRefs経由でDOMを直接動かす
   * （Reactの再レンダーを介さない、既存のパフォーマンス上の理由）。ただしシャッフル完了後、
   * phaseを'answer'へ切り替えるのと同時にこのstateも最終位置へ更新しないと、次の再レンダー時に
   * JSXのstyle={{left,top}}が古い初期配置（SLOT_POSITIONS[boxId]）で上書きしてしまい、
   * 「シャッフルが終わった瞬間に全箱が最初の配置へ瞬間移動して見える」という重大な表示不整合が
   * 起きる（実装中に発見・修正済み）。
   */
  const [boxDisplayPositions, setBoxDisplayPositions] = useState<{ x: number; y: number }[]>(SLOT_POSITIONS)
  const [openBoxIds, setOpenBoxIds] = useState<Set<number>>(new Set())
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [darken, setDarken] = useState(false)
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  const boxRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null, null, null])
  /** boxId→現在の角度（度）。アニメーション中はここを直接更新し、DOMへも直接反映する（Reactの再レンダーを介さない）。 */
  const boxAngleRef = useRef<number[]>(SLOT_ANGLES.map((a) => a))

  function setBoxPosition(boxId: number, pos: { x: number; y: number }) {
    const el = boxRefs.current[boxId]
    if (!el) return
    el.style.left = `${pos.x}%`
    el.style.top = `${pos.y}%`
  }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let rafId: number | null = null

    timers.push(
      setTimeout(() => {
        setPhase('reveal')
        // B-3: 5つの宝箱を全て開き、1つだけ黄金・残り4つは空であることを見せる。
        setOpenBoxIds(new Set([0, 1, 2, 3, 4]))
      }, GOAL_MS),
    )
    timers.push(
      setTimeout(() => {
        setPhase('closing')
        setOpenBoxIds(new Set())
      }, GOAL_MS + REVEAL_MS),
    )
    timers.push(
      setTimeout(() => {
        setPhase('shuffling')
        // 現在slotToBox=[0,1,2,3,4]（boxId=slot、初期配置）からスタートして、
        // moveSequenceを1ステップずつ実際にアニメーションで再生する。
        let slotToBox = [0, 1, 2, 3, 4]
        let stepIndex = 0

        function runStep() {
          if (stepIndex >= moveSequence.length) {
            // シャッフル完了：直前までDOM直接操作で動かしていた最終位置をReact stateへ確定させてから
            // phaseを切り替える（同時に行うことで、次の再レンダーが古い初期配置へ戻すのを防ぐ）。
            setBoxDisplayPositions(boxAngleRef.current.map((angle) => angleToPos(angle)))
            setPhase('answer')
            startRef.current = performance.now()
            return
          }
          const step = moveSequence[stepIndex]
          // このステップで動くboxごとの開始角度・目標角度・スタイルを事前計算する
          const nextSlotToBox = applyStep(slotToBox, step)
          const boxAnims: { boxId: number; fromAngle: number; toAngle: number; style: SwapStyle | 'rotate'; longWay: boolean }[] = []
          for (const move of step.moves) {
            if (move.kind === 'swap') {
              const boxA = slotToBox[move.a]
              const boxB = slotToBox[move.b]
              boxAnims.push({ boxId: boxA, fromAngle: SLOT_ANGLES[move.a], toAngle: SLOT_ANGLES[move.b], style: move.style, longWay: false })
              boxAnims.push({ boxId: boxB, fromAngle: SLOT_ANGLES[move.b], toAngle: SLOT_ANGLES[move.a], style: move.style, longWay: false })
            } else if (move.kind === 'rotate3') {
              const [x, y, z] = move.slots
              const seq: [number, number][] = move.dir === 1 ? [[x, y], [y, z], [z, x]] : [[y, x], [z, y], [x, z]]
              for (const [fromSlot, toSlot] of seq) {
                boxAnims.push({ boxId: slotToBox[fromSlot], fromAngle: SLOT_ANGLES[fromSlot], toAngle: SLOT_ANGLES[toSlot], style: 'rotate', longWay: move.longWay })
              }
            } else {
              for (let i = 0; i < SLOT_COUNT; i++) {
                const from = move.dir === 1 ? (i + SLOT_COUNT - 1) % SLOT_COUNT : (i + 1) % SLOT_COUNT
                boxAnims.push({ boxId: slotToBox[from], fromAngle: SLOT_ANGLES[from], toAngle: SLOT_ANGLES[i], style: 'rotate', longWay: move.longWay })
              }
            }
          }
          const stepStart = performance.now()
          function frame() {
            const t = Math.min(1, (performance.now() - stepStart) / step.durationMs)
            for (const anim of boxAnims) {
              if (anim.style === 'rotate') {
                const pos = rotatePathPosition(anim.fromAngle, anim.toAngle, t, anim.longWay)
                setBoxPosition(anim.boxId, pos)
                if (t >= 1) boxAngleRef.current[anim.boxId] = anim.toAngle
              } else {
                const pos = swapPathPosition(angleToPos(anim.fromAngle), angleToPos(anim.toAngle), t, anim.style)
                setBoxPosition(anim.boxId, pos)
                if (t >= 1) boxAngleRef.current[anim.boxId] = anim.toAngle
              }
            }
            if (t < 1) {
              rafId = requestAnimationFrame(frame)
            } else {
              slotToBox = nextSlotToBox
              stepIndex++
              runStep()
            }
          }
          rafId = requestAnimationFrame(frame)
        }
        runStep()
      }, GOAL_MS + REVEAL_MS + CLOSING_MS),
    )

    return () => {
      timers.forEach(clearTimeout)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: startRef.current !== null ? performance.now() - startRef.current : 0 })
  }

  function handleSelect(boxId: number) {
    if (phase !== 'answer' || guardRef.current!.isResolved) return
    setPhase('selecting')
    setSelectedBoxId(boxId)
    const correct = boxId === goldChestId
    setTimeout(() => {
      setPhase('opening')
      setOpenBoxIds(new Set([boxId]))
      setTimeout(() => {
        setWasCorrect(correct)
        if (correct) {
          sfx.finalSuccess(5)
          setTimeout(() => finish(true), CORRECT_GLOW_MS)
        } else {
          setTimeout(() => {
            sfx.finalMiss()
            setDarken(true)
            // B-16: 不正解時、正解の宝箱も短く自動で開いて見せる（長すぎない程度に）
            setOpenBoxIds(new Set([boxId, goldChestId]))
            setTimeout(() => finish(false), WRONG_DARK_MS)
          }, WRONG_REVEAL_MS)
        }
      }, OPEN_CREAK_MS)
    }, SELECT_PAUSE_MS)
  }

  // Preview専用（?preview=clear200）：回答受付後、autoSolveDelayMs経過で正解の宝箱を
  // 実際のUI操作と同じhandleSelect()経由で自動選択する（本物の選択→開封演出を必ず経由する）。
  const autoSolveFiredRef = useRef(false)
  useEffect(() => {
    if (autoSolveDelayMs === undefined || autoSolveFiredRef.current || phase !== 'answer') return
    autoSolveFiredRef.current = true
    const t = setTimeout(() => handleSelect(goldChestId), autoSolveDelayMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const headline =
    phase === 'goal'
      ? 'FINAL QUESTION'
      : phase === 'reveal'
        ? '中身を覚えろ！'
        : phase === 'closing'
          ? 'フタを閉じる…'
          : phase === 'shuffling'
            ? '最後まで見失うな…'
            : phase === 'answer'
              ? '金が入っている宝箱はどれ？'
              : ''
  const sub = phase === 'goal' ? '金が入っている宝箱はどれ？' : phase === 'reveal' ? '黄金の宝を最後まで追え！' : undefined

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center select-none">
      {headline && (
        <div className="flex flex-col items-center gap-1">
          {sub && <p className="text-xs font-bold tracking-wide text-amber-200/80">{sub}</p>}
          <p className="whitespace-pre-line text-2xl font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {headline}
          </p>
        </div>
      )}
      {(phase === 'opening' && wasCorrect !== null) && (
        <p
          className={`text-2xl font-black ${wasCorrect ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(250,204,21,0.9)]' : 'text-white/50'}`}
        >
          {wasCorrect ? '黄金の宝を発見！' : '空だった……'}
        </p>
      )}

      {phase !== 'goal' && (
        <div className={`relative h-72 w-full max-w-xs transition-opacity duration-300 ${darken ? 'opacity-25' : 'opacity-100'}`}>
          {[0, 1, 2, 3, 4].map((boxId) => {
            const isGold = boxId === goldChestId
            const isOpen = openBoxIds.has(boxId)
            const isSelected = selectedBoxId === boxId
            const isDimmed = selectedBoxId !== null && !isSelected
            return (
              <button
                key={boxId}
                ref={(el) => {
                  boxRefs.current[boxId] = el
                }}
                onPointerDown={() => handleSelect(boxId)}
                disabled={phase !== 'answer'}
                style={{
                  left: `${boxDisplayPositions[boxId].x}%`,
                  top: `${boxDisplayPositions[boxId].y}%`,
                  zIndex: isSelected ? 20 : 10,
                }}
                className={`absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl border-2 border-amber-400/70 bg-gradient-to-b from-[#241233] to-[#0a0512] shadow-[0_5px_0_0_rgba(0,0,0,0.7),0_0_10px_rgba(250,204,21,0.25)] transition-all duration-300 active:scale-90 ${
                  isSelected ? 'scale-125' : isDimmed ? 'scale-90 opacity-30' : ''
                }`}
              >
                <span className="absolute inset-x-2 top-1 h-1.5 rounded-full bg-amber-400/50" />
                <span className="absolute h-2.5 w-2.5 rounded-full bg-amber-300/80 shadow-[0_0_6px_rgba(250,204,21,0.9)]" />
                {isOpen && (
                  <span
                    className={`absolute -top-2 text-2xl ${isGold ? 'anim-pop drop-shadow-[0_0_14px_rgba(250,204,21,1)]' : 'opacity-40'}`}
                  >
                    {isGold ? '✨🪙✨' : '　'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const FinalQuestionBoxModule: FinalQuestionModule = {
  id: 'finalQuestionBox',
  tags: ['memory', 'visual'],
  // Q16専用固定問題のためtierプールには含めない（値自体は型合わせのための形式的なもの）。
  tier: 'mixed',
  generate: generateChestShuffle,
  computeTargetTimeMs,
  Component,
}
