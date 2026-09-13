import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.speedToggle

const LINES = ['静かな朝でした。', 'コーヒーの湯気が揺れています。', '時間がゆっくり流れていきます。']

export function SpeedToggleEvent({ onComplete }: EventComponentProps) {
  const [lineIndex, setLineIndex] = useState(0)
  const [is2x, setIs2x] = useState(false)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const perLine = CFG.totalMs / LINES.length
    const speedFactor = is2x ? 0.5 : 1
    const lineTimer = setInterval(
      () => {
        setLineIndex((i) => Math.min(LINES.length - 1, i + 1))
      },
      perLine * speedFactor,
    )
    const totalTimer = setTimeout(() => finish(false), CFG.totalMs * speedFactor)

    return () => {
      clearInterval(lineTimer)
      clearTimeout(totalTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is2x])

  function finish(toggled: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const score = toggled ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'speedToggle',
      category: 'stimulation',
      score,
      crimeText: toggled && score >= V2_CONFIG.crimeThreshold ? crimeText.speedToggle(elapsedMs / 1000) : undefined,
    })
  }

  function handleToggle() {
    if (is2x || doneRef.current) return
    setIs2x(true)
    finish(true)
  }

  return (
    <EventShell>
      <p className="min-h-[3lh] text-sm leading-relaxed text-white/70">{LINES[lineIndex]}</p>
      <div className="flex overflow-hidden rounded-full bg-white/10 text-xs font-bold">
        <span className={`px-4 py-2 ${!is2x ? 'bg-white/20 text-white' : 'text-white/40'}`}>1.0x</span>
        <button onClick={handleToggle} className={`px-4 py-2 ${is2x ? 'bg-fuchsia-500 text-white' : 'text-white/40'}`}>
          2.0x
        </button>
      </div>
    </EventShell>
  )
}
