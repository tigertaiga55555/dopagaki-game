import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

/** ボールの開始位置とゴール候補位置（開始位置から十分離れた場所を選ぶ）。 */
const START_POS = { x: 50, y: 40 }
const GOAL_CANDIDATES = [
  { x: 18, y: 78 },
  { x: 82, y: 78 },
  { x: 18, y: 20 },
  { x: 82, y: 20 },
]
/** ゴール判定の半径（%）。厳密すぎる当たり判定を避けるため広めに取る。 */
const GOAL_RADIUS_PCT = 16

/**
 * Ver.4.9で追加。「丸をゴールへ運べ！」：中央付近の丸をドラッグしてゴールエリアまで
 * 運べばSUCCESS。タップだけではSUCCESSにならない（十分に動かす必要がある）。
 * ドラッグ開始後はpointer captureで指を追従させ、多少ズレても操作を継続できるように
 * する。ゴール判定はやや広め（半径16%）にして、厳密すぎる当たり判定を避ける。
 */
function generate() {
  return { goal: GOAL_CANDIDATES[randInt(0, GOAL_CANDIDATES.length - 1)] }
}

function computeMinTargetTimeMs() {
  return TIMING_SAFETY.dragGoal.minTimeMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { goal } = spec.data as { goal: { x: number; y: number } }
  const [pos, setPos] = useState(START_POS)
  const [dragging, setDragging] = useState(false)
  const [landed, setLanded] = useState<'success' | 'fail' | null>(null)
  const startRef = useRef(performance.now())
  const containerRef = useRef<HTMLDivElement>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function toPct(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return pos
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }

  function handleBallDown(e: ReactPointerEvent) {
    if (guardRef.current!.isResolved || landed) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
    setPos(toPct(e.clientX, e.clientY))
  }
  function handleBallMove(e: ReactPointerEvent) {
    if (!dragging || landed) return
    setPos(toPct(e.clientX, e.clientY))
  }
  function handleBallUp(e: ReactPointerEvent) {
    if (!dragging || landed) return
    setDragging(false)
    const finalPos = toPct(e.clientX, e.clientY)
    setPos(finalPos)
    const dist = Math.hypot(finalPos.x - goal.x, finalPos.y - goal.y)
    const success = dist <= GOAL_RADIUS_PCT
    setLanded(success ? 'success' : 'fail')
    if (success) sfx.zoneRelease()
    setTimeout(() => finish(success), 160)
  }

  return (
    <QuestionShell instruction={'丸をゴールへ\n運べ！'}>
      <div ref={containerRef} className="relative h-64 w-full max-w-xs touch-none select-none">
        <div
          className="absolute flex items-center justify-center rounded-2xl border-4 border-dashed border-emerald-300/70 bg-emerald-500/15 text-xs font-black text-emerald-200"
          style={{
            left: `${goal.x}%`,
            top: `${goal.y}%`,
            width: `${GOAL_RADIUS_PCT * 2}%`,
            height: `${GOAL_RADIUS_PCT * 2}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          GOAL
        </div>
        <div
          onPointerDown={handleBallDown}
          onPointerMove={handleBallMove}
          onPointerUp={handleBallUp}
          onPointerCancel={handleBallUp}
          className={`absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b shadow-lg active:scale-95 ${
            landed === 'success' ? 'from-emerald-300 to-emerald-500' : 'from-fuchsia-400 to-purple-600'
          }`}
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        />
      </div>
    </QuestionShell>
  )
}

export const DragGoalQuestionModule: QuestionModule = {
  id: 'dragGoal',
  category: 'timing',
  baseTargetTimeMs: 2600,
  generate,
  Component,
  computeMinTargetTimeMs,
}
