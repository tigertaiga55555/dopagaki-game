import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { pick } from '../engine/random'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule } from '../types'

const FOOD_ICONS = ['🍎', '🍌', '🍇', '🍕', '🍔', '🍣', '🍩', '🍞']
const OTHER_ICONS = ['🚗', '⚽', '🎈', '⭐', '🚀', '🎸', '📱', '👟']

const SWIPE_THRESHOLD_PX = 50
/** 成功時、アイコンが仕分け方向へ飛んでいく演出の長さ */
const FLY_MS = 180
/** カードが指に追従する量（1.0で完全追従、小さいほど重く感じる） */
const FOLLOW_RATIO = 0.5
/** スワイプ未満のドラッグで終わった＝迷っている、と判断してnudgeを出す時間 */
const NUDGE_MS = 700

/**
 * Ver.4.3で復活、Ver.4.6でUI強化、Ver.4.8で再設計。
 *
 * 反省点：これまでの「← 食べ物｜その他 →」ピルは背景色付きで押せそうに見えてしまい、
 * 「タップするものだと思ったら実はスワイプだった」という誤解を生んでいた。
 * Ver.4.8では中央のカードを主役に据え、左右のラベルは背景を持たない薄いガイド文字
 * （「食べ物 → 左へスワイプ」「その他 → 右へスワイプ」と“スワイプ”を明言）に変更し、
 * 背景に薄い方向矢印を大きく置くことで「これは操作ボタンではなく方向の目印」だと
 * 一目で分かるようにした。また、閾値未満のドラッグで終わった（＝タップしただけ、
 * または迷って止めた）場合は即MISSにせず、「←→にスワイプ！」の一時的な念押しを
 * 出すだけに留める。明確に逆方向へスワイプした場合のみMISSにする。
 */
function generate() {
  const isFood = Math.random() < 0.5
  const icon = isFood ? pick(FOOD_ICONS) : pick(OTHER_ICONS)
  return { isFood, icon }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { isFood, icon } = spec.data as { isFood: boolean; icon: string }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null)
  const [showNudge, setShowNudge] = useState(false)
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(timer)
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current)
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (doneRef.current || flyDirection) return
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragStartRef.current || flyDirection) return
    setDragX((e.clientX - dragStartRef.current.x) * FOLLOW_RATIO)
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!dragStartRef.current || flyDirection) return
    const dx = e.clientX - dragStartRef.current.x
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
      // タップだけ、または迷って途中で止めた＝即MISSにせず「スワイプしろ」を一時的に強調するだけ
      setDragX(0)
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
      setShowNudge(true)
      nudgeTimerRef.current = setTimeout(() => setShowNudge(false), NUDGE_MS)
      return
    }
    const wentLeft = dx < 0
    const correct = wentLeft === isFood
    if (!correct) {
      setDragX(0)
      finish(false)
      return
    }
    // 判定は今この瞬間に確定させ（doneRef true）、外側タイマーに書き換えられないようにしてから、
    // 演出（飛んでいく）のぶんだけ結果通知を遅らせる。
    sfx.swipeSuccess()
    doneRef.current = true
    setFlyDirection(wentLeft ? 'left' : 'right')
    flyTimerRef.current = setTimeout(() => {
      onResult({ correct: true, reactionMs: performance.now() - startRef.current })
    }, FLY_MS)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
        setDragX(0)
      }}
      className="relative flex h-full w-full touch-none select-none flex-col items-center gap-4 pt-3"
    >
      {/* 背景の薄い方向ガイド矢印（操作対象ではなく、あくまで目印） */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 opacity-[0.14]">
        <span className="text-8xl font-black text-emerald-300">←</span>
        <span className="text-8xl font-black text-sky-300">→</span>
      </div>

      <div className="relative z-10 flex w-full max-w-xs items-center justify-between px-1 text-xs font-black">
        <span className="text-emerald-300">食べ物 → 左へスワイプ</span>
        <span className="text-sky-300">その他 → 右へスワイプ</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
        <p
          className="text-8xl"
          style={{
            transform: flyDirection
              ? `translateX(${flyDirection === 'left' ? -260 : 260}px) scale(0.5) rotate(${flyDirection === 'left' ? -20 : 20}deg)`
              : `translateX(${dragX}px) rotate(${Math.max(-12, Math.min(12, dragX * 0.06))}deg)`,
            opacity: flyDirection ? 0 : 1,
            transition: flyDirection ? `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in` : undefined,
          }}
        >
          {icon}
        </p>
        <p
          className={`text-sm font-black text-amber-200 transition-opacity ${showNudge ? 'opacity-100' : 'opacity-0'}`}
        >
          ← → にスワイプ！
        </p>
      </div>
    </div>
  )
}

export const FoodSortQuestionModule: QuestionModule = {
  id: 'foodSort',
  category: 'reaction',
  baseTargetTimeMs: 1600,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.foodSort.minTimeMs,
}
