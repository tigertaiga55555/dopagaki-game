import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.shortContent

const SLIDES = ['🌊', '🌤️', '🌿']

export function ShortContentEvent({ onComplete }: EventComponentProps) {
  const [slideIndex, setSlideIndex] = useState(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const touchStartYRef = useRef<number | null>(null)

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setSlideIndex((i) => (i + 1) % SLIDES.length)
    }, CFG.totalMs / SLIDES.length)

    const autoTimer = setTimeout(() => finish(false), CFG.totalMs)

    return () => {
      clearInterval(slideTimer)
      clearTimeout(autoTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(swiped: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const score = swiped ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'shortContent',
      category: 'stimulation',
      score,
      crimeText: swiped && score >= V2_CONFIG.crimeThreshold ? crimeText.shortContent(elapsedMs / 1000) : undefined,
    })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    touchStartYRef.current = e.clientY
  }

  function handlePointerUp(e: ReactPointerEvent) {
    if (touchStartYRef.current === null) return
    const deltaY = touchStartYRef.current - e.clientY
    touchStartYRef.current = null
    if (deltaY > CFG.swipeThresholdPx) {
      finish(true)
    }
  }

  return (
    <div
      className="flex min-h-[calc(100dvh-2.5rem)] touch-none flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1c1033] to-[#0b0620] px-6 py-8 text-center select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="flex h-64 w-full max-w-[220px] items-center justify-center rounded-3xl bg-white/5 text-7xl">
        {SLIDES[slideIndex]}
      </div>
      <p className="animate-pulse text-xs font-bold text-white/40">↑ 上にスワイプで次へ</p>
    </div>
  )
}
