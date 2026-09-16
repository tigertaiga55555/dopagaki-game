import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule } from '../types'

const CARD_ICONS = ['🎬', '🎵', '🎮', '🍿', '✨', '🎧', '📸', '🎨']
const SWIPE_THRESHOLD_PX = 50
const REQUIRED_SWIPES = 3
/** カードが飛んでいく演出の長さ */
const FLY_MS = 160
/** 1回の正しいスワイプ後、残りスワイプぶんの猶予を確保するための1回あたりの見込み時間 */
const PER_REMAINING_SWIPE_MS = TIMING_SAFETY.shortVideoSwipe.perSwipeMs + 250

/**
 * Ver.4.5で追加、Ver.4.6でUI強化。「↑ 上に3回スワイプ！」を固定表示し、
 * 「あとN本」という残数表示とカードが飛んでいく演出で操作を視覚的にも理解できるようにした。
 *
 * Ver.4.6の重要な修正：外側の汎用タイムアウトはマウント時に一度だけセットされていたため、
 * 3回のスワイプそれぞれで想定より少し反応が遅れただけでも、正しく操作している最中に
 * タイムアウトが先に発火してMISSになるレースがあった。1回正しくスワイプするたびに、
 * 残りスワイプ数ぶんの猶予でタイマーを引き直すことでこれを防ぐ。
 */
function generate() {
  const cards = shuffle(CARD_ICONS).slice(0, REQUIRED_SWIPES)
  return { cards }
}

function computeMinTargetTimeMs() {
  return REQUIRED_SWIPES * TIMING_SAFETY.shortVideoSwipe.perSwipeMs + TIMING_SAFETY.shortVideoSwipe.reactionBufferMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { cards } = spec.data as { cards: string[] }
  const [cardIndex, setCardIndex] = useState(0)
  const [flying, setFlying] = useState(false)
  const cardIndexRef = useRef(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (doneRef.current || flying) return
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (doneRef.current || flying || !dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return
    const isUp = -dy > Math.abs(dx) && -dy >= SWIPE_THRESHOLD_PX
    if (!isUp) {
      finish(false)
      return
    }
    sfx.swipeSuccess()
    const next = cardIndexRef.current + 1
    setFlying(true)
    // 正しいスワイプが確定した時点で、外側タイマーを即座に無効化してから引き直す。
    // 「演出待ちの間に古いタイマーが先に発火してMISSにする」レースを構造的に防ぐ。
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (next < REQUIRED_SWIPES) {
      const remaining = REQUIRED_SWIPES - next
      failTimerRef.current = setTimeout(() => finish(false), remaining * PER_REMAINING_SWIPE_MS + FLY_MS + 300)
    }
    flyTimerRef.current = setTimeout(() => {
      if (next >= REQUIRED_SWIPES) {
        finish(true)
        return
      }
      cardIndexRef.current = next
      setCardIndex(next)
      setFlying(false)
    }, FLY_MS)
  }

  const remaining = REQUIRED_SWIPES - cardIndex

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
      }}
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-5"
    >
      <p className="text-2xl font-black text-white">↑ 上に3回スワイプ！</p>
      <div
        className="flex h-52 w-36 flex-col items-center justify-center gap-2 rounded-2xl bg-white/10 text-7xl"
        style={{
          transform: flying ? 'translateY(-140px) scale(0.7)' : 'translateY(0) scale(1)',
          opacity: flying ? 0 : 1,
          transition: `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`,
        }}
      >
        {cards[cardIndex]}
      </div>
      <p className="text-lg font-black text-amber-200/90">{remaining > 0 ? `あと${remaining}回` : '完了！'}</p>
    </div>
  )
}

export const ShortVideoSwipeQuestionModule: QuestionModule = {
  id: 'shortVideoSwipe',
  category: 'gesture',
  baseTargetTimeMs: 2600,
  generate,
  Component,
  computeMinTargetTimeMs,
}
