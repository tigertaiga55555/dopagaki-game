import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByCount } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.tapSpeed

export function TapSpeedEvent({ onComplete }: EventComponentProps) {
  const [progress, setProgress] = useState(0)
  const [hintVisible, setHintVisible] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)
  const tapCountRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const start = performance.now()
    let raf: number
    const tick = () => {
      const elapsed = performance.now() - start
      const ratio = Math.min(1, elapsed / CFG.totalMs)
      setProgress(Math.round(ratio * 100))
      if (ratio >= 1) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const hintTimer = setTimeout(() => setHintVisible(true), CFG.hintDelayMs)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hintTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTap() {
    if (doneRef.current) return
    tapCountRef.current += 1
    setPulseKey((k) => k + 1)
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const count = tapCountRef.current
    const score = scoreByCount(count, CFG.tapBands, CFG.fallbackScore)
    onComplete({
      eventId: 'tapSpeed',
      category: 'impulse',
      score,
      crimeText: score >= V2_CONFIG.crimeThreshold ? crimeText.tapSpeed(count) : undefined,
    })
  }

  return (
    <div onPointerDown={handleTap} className="cursor-pointer">
      <EventShell>
        <p className="text-sm font-bold text-white/60">読み込んでいます……</p>
        <div key={pulseKey} className="anim-spike h-16 w-16 rounded-full bg-gradient-to-b from-fuchsia-500 to-purple-600" />
        <div className="w-full max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white/70" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {hintVisible && <p className="text-xs text-white/40">タップすると速くなるかも？</p>}
      </EventShell>
    </div>
  )
}
