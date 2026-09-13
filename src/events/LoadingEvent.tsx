import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.loading
const RAMP_STEPS = [0, 30, 72, 99]

export function LoadingEvent({ onComplete }: EventComponentProps) {
  const [progress, setProgress] = useState(0)
  const [skipVisible, setSkipVisible] = useState(false)
  const holdStartRef = useRef<number>(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const stepDelay = CFG.rampMs / (RAMP_STEPS.length - 1)
    const timers: ReturnType<typeof setTimeout>[] = []

    RAMP_STEPS.forEach((value, i) => {
      timers.push(
        setTimeout(() => {
          setProgress(value)
          if (value === 99) {
            holdStartRef.current = performance.now()
          }
        }, stepDelay * i),
      )
    })

    timers.push(
      setTimeout(() => {
        setSkipVisible(true)
      }, CFG.rampMs + CFG.skipLinkDelayMs),
    )

    timers.push(
      setTimeout(() => {
        finish(false)
      }, CFG.rampMs + CFG.autoAdvanceMs),
    )

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(skipped: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = holdStartRef.current ? performance.now() - holdStartRef.current : CFG.autoAdvanceMs
    const score = skipped ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'loading',
      category: 'impatience',
      score,
      crimeText: skipped && score >= V2_CONFIG.crimeThreshold ? crimeText.loading(elapsedMs / 1000) : undefined,
    })
  }

  return (
    <EventShell>
      <p className="text-sm font-bold text-white/60">読み込んでいます……</p>
      <div className="w-full max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-3xl font-black tabular-nums">{progress}%</p>
      </div>
      {skipVisible && progress === 99 && (
        <button onClick={() => finish(true)} className="anim-pop text-xs font-bold text-white/40 underline">
          待てない？ スキップ
        </button>
      )}
    </EventShell>
  )
}
