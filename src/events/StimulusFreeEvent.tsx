import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.stimulusFree

export function StimulusFreeEvent({ onComplete }: EventComponentProps) {
  const [buttonVisible, setButtonVisible] = useState(false)
  const shownAtRef = useRef<number>(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const showTimer = setTimeout(() => {
      shownAtRef.current = performance.now()
      setButtonVisible(true)
    }, CFG.buttonDelayMs)

    const autoTimer = setTimeout(() => {
      finish(false)
    }, CFG.totalMs)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(autoTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(pressed: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = shownAtRef.current ? performance.now() - shownAtRef.current : CFG.totalMs
    const score = pressed ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'stimulusFree',
      category: 'stimulation',
      score,
      crimeText: pressed && score >= V2_CONFIG.crimeThreshold ? crimeText.stimulusFree(elapsedMs / 1000) : undefined,
    })
  }

  return (
    <EventShell>
      <p className="text-sm text-white/40">……移動中……</p>
      <div className="h-16 w-16 rounded-full border border-white/10" />
      {buttonVisible && (
        <button
          onClick={() => finish(true)}
          className="anim-pop rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white/70"
        >
          音楽を流す
        </button>
      )}
    </EventShell>
  )
}
