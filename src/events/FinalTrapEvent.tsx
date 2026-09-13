import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.finalTrap

export function FinalTrapEvent({ onComplete }: EventComponentProps) {
  const [secondsLeft, setSecondsLeft] = useState(3)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const tickTimer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    const timer = setTimeout(() => finish(false), CFG.countdownMs)
    return () => {
      clearInterval(tickTimer)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(pressed: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const score = pressed ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'finalTrap',
      category: 'result',
      score,
      crimeText: pressed && score >= V2_CONFIG.crimeThreshold ? crimeText.finalTrap(elapsedMs / 1000) : undefined,
    })
  }

  return (
    <EventShell>
      <p className="text-sm font-bold text-white/60">結果を計算中……</p>
      <p className="text-2xl font-black tabular-nums">あと{secondsLeft}秒</p>
      <button
        onClick={() => finish(true)}
        className="w-full max-w-xs rounded-2xl bg-white/10 py-4 text-base font-bold text-white/80"
      >
        今すぐ結果を見る
      </button>
    </EventShell>
  )
}
