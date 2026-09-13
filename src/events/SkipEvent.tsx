import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.skip

const DESCRIPTION =
  'このゲームでは、画面の指示に従って操作するだけです。特別な準備は必要ありません。深呼吸をして、リラックスして始めてください。'

export function SkipEvent({ onComplete }: EventComponentProps) {
  const [skipVisible, setSkipVisible] = useState(false)
  const shownAtRef = useRef<number>(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const showTimer = setTimeout(() => {
      shownAtRef.current = performance.now()
      setSkipVisible(true)
    }, CFG.readDelayMs)

    const autoTimer = setTimeout(() => {
      finish(false)
    }, CFG.readDelayMs + CFG.autoAdvanceMs)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(autoTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(skipped: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = shownAtRef.current ? performance.now() - shownAtRef.current : CFG.autoAdvanceMs
    const score = skipped ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'skip',
      category: 'skip',
      score,
      crimeText: skipped && score >= V2_CONFIG.crimeThreshold ? crimeText.skip(elapsedMs / 1000) : undefined,
    })
  }

  return (
    <EventShell>
      <p className="text-sm leading-relaxed text-white/80">{DESCRIPTION}</p>
      {skipVisible && (
        <button
          onClick={() => finish(true)}
          className="anim-pop rounded-full bg-white/10 px-6 py-2.5 text-sm font-bold text-white/80"
        >
          SKIP
        </button>
      )}
    </EventShell>
  )
}
