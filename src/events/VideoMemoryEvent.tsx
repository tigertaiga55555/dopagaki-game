import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { pick, randInt, shuffle } from '../engine/random'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.videoMemory
const COLORS = [
  { id: 'red', emoji: '🔴' },
  { id: 'blue', emoji: '🔵' },
  { id: 'green', emoji: '🟢' },
  { id: 'yellow', emoji: '🟡' },
]

function buildOptions(correct: number): number[] {
  const set = new Set<number>([correct])
  while (set.size < 4) {
    const candidate = correct + randInt(-2, 2)
    if (candidate >= 0) set.add(candidate)
  }
  return shuffle([...set])
}

function Content({ onComplete }: EventComponentProps) {
  const [shapeIndex, setShapeIndex] = useState(-1)
  const [phase, setPhase] = useState<'playing' | 'quiz'>('playing')
  const [is2x, setIs2x] = useState(false)
  const [toggleVisible, setToggleVisible] = useState(false)

  const sequenceRef = useRef(Array.from({ length: CFG.shapeCount }, () => pick(COLORS)))
  const correctCountRef = useRef(sequenceRef.current.filter((c) => c.id === 'red').length)
  const optionsRef = useRef(buildOptions(correctCountRef.current))
  const startRef = useRef(performance.now())
  const toggleElapsedRef = useRef<number | null>(null)
  const is2xRef = useRef(false)

  useEffect(() => {
    const toggleTimer = setTimeout(() => setToggleVisible(true), CFG.speedToggleShowDelayMs)

    let raf: number
    let last = performance.now()
    let effective = 0
    const tick = (now: number) => {
      const dt = now - last
      last = now
      effective += dt * (is2xRef.current ? CFG.speedMultiplier : 1)
      const idx = Math.min(CFG.shapeCount - 1, Math.floor(effective / CFG.perShapeMs))
      setShapeIndex(idx)
      if (effective >= CFG.perShapeMs * CFG.shapeCount) {
        setPhase('quiz')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      clearTimeout(toggleTimer)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleToggle() {
    if (is2xRef.current) return
    is2xRef.current = true
    setIs2x(true)
    toggleElapsedRef.current = performance.now() - startRef.current
  }

  function handleAnswer(value: number) {
    const correct = value === correctCountRef.current
    const elapsed = toggleElapsedRef.current
    const score = elapsed !== null ? scoreByElapsed(elapsed, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'videoMemory',
      scoreDelta: correct ? CFG.correct : CFG.incorrect,
      diagnostic: {
        category: 'speed',
        score,
        crimeText: elapsed !== null && score >= V3_CONFIG.crimeThreshold ? `動画開始${(elapsed / 1000).toFixed(1)}秒で2倍速` : undefined,
      },
    })
  }

  if (phase === 'quiz') {
    return (
      <EventShell>
        <p className="text-sm font-bold text-white/60">赤い丸はいくつ出た？</p>
        <div className="grid grid-cols-2 gap-3">
          {optionsRef.current.map((n) => (
            <button
              key={n}
              onClick={() => handleAnswer(n)}
              className="rounded-2xl bg-white/10 py-4 text-xl font-black text-white active:bg-white/20"
            >
              {n}
            </button>
          ))}
        </div>
      </EventShell>
    )
  }

  return (
    <EventShell>
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 text-6xl">
        {shapeIndex >= 0 ? sequenceRef.current[shapeIndex].emoji : ''}
      </div>
      {toggleVisible && (
        <div className="flex overflow-hidden rounded-full bg-white/10 text-xs font-bold">
          <span className={`px-4 py-2 ${!is2x ? 'bg-white/20 text-white' : 'text-white/40'}`}>1.0x</span>
          <button onClick={handleToggle} className={`px-4 py-2 ${is2x ? 'bg-fuchsia-500 text-white' : 'text-white/40'}`}>
            2.0x
          </button>
        </div>
      )}
    </EventShell>
  )
}

export function VideoMemoryEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.videoMemory}>
      <Content {...props} />
    </EventIntro>
  )
}
