import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { shuffle } from '../engine/random'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule } from '../types'

const CARD_ICONS = ['🎬', '🎵', '🎮', '🍿', '✨', '🎧', '📸', '🎨']
const SWIPE_THRESHOLD_PX = 50
const REQUIRED_SWIPES = 3

/** 「3本飛ばせ！」：縦スワイプでカードを次々送る。逆方向スワイプはMISS。 */
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
  const cardIndexRef = useRef(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (doneRef.current || !dragStartRef.current) return
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
    if (next >= REQUIRED_SWIPES) {
      finish(true)
      return
    }
    cardIndexRef.current = next
    setCardIndex(next)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
      }}
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-6"
    >
      <p className="text-2xl font-black text-white">3本飛ばせ！ ↑</p>
      <div className="flex h-52 w-36 flex-col items-center justify-center gap-2 rounded-2xl bg-white/10 text-7xl">
        {cards[cardIndex]}
      </div>
      <p className="text-sm font-bold text-white/60">{cardIndex + 1} / {REQUIRED_SWIPES}</p>
    </div>
  )
}

export const ShortVideoSwipeQuestionModule: QuestionModule = {
  id: 'shortVideoSwipe',
  category: 'rapid',
  baseTargetTimeMs: 2600,
  generate,
  Component,
  computeMinTargetTimeMs,
}
