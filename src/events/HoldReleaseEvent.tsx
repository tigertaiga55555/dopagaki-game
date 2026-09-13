import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.holdRelease

function Content({ onComplete }: EventComponentProps) {
  const [heldMs, setHeldMs] = useState(0)
  const [released, setReleased] = useState(false)
  const startRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    let raf: number
    const tick = () => {
      if (doneRef.current) return
      // ボタンをまだ押していない間もループ自体は生かしておき、押した瞬間から計測を始められるようにする
      if (startRef.current !== null) {
        const elapsed = performance.now() - startRef.current
        setHeldMs(Math.min(CFG.maxMs, elapsed))
        if (elapsed >= CFG.maxMs) {
          finish(CFG.maxMs)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDown() {
    if (doneRef.current) return
    startRef.current = performance.now()
  }

  function handleUp() {
    if (doneRef.current || startRef.current === null) return
    const elapsed = performance.now() - startRef.current
    finish(elapsed)
  }

  function finish(elapsedMs: number) {
    if (doneRef.current) return
    doneRef.current = true
    setReleased(true)
    const clamped = Math.min(CFG.maxMs, elapsedMs)
    const reward = clamped >= CFG.maxMs ? CFG.autoReward : Math.floor(clamped / CFG.tierMs) * CFG.tierReward
    const score = scoreByElapsed(clamped, CFG.bands, CFG.fallbackScore)
    onComplete({
      eventId: 'holdRelease',
      scoreDelta: reward,
      diagnostics: [
        {
          category: 'patience',
          score,
          crimeText: score >= V3_CONFIG.crimeThreshold ? `${(clamped / 1000).toFixed(1)}秒で${reward}ptに飛びつき` : undefined,
        },
      ],
    })
  }

  const tier = Math.min(5, Math.floor(heldMs / CFG.tierMs))
  const label =
    tier <= 0
      ? '押し続けろ'
      : tier >= 5
        ? `＋${CFG.autoReward}`
        : `今離す → ＋${tier * CFG.tierReward}`

  return (
    <EventShell>
      <button
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        disabled={released}
        className="h-32 w-32 select-none rounded-full bg-gradient-to-b from-fuchsia-500 to-purple-600 text-sm font-black text-white active:scale-95"
      >
        HOLD
      </button>
      <p className="text-lg font-bold text-white/80">{label}</p>
    </EventShell>
  )
}

export function HoldReleaseEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.holdRelease}>
      <Content {...props} />
    </EventIntro>
  )
}
