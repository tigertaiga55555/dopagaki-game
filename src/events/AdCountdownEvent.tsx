import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.adCountdown

function Content({ onComplete }: EventComponentProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(CFG.countdownMs / 1000))
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

  function finish(skipped: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const score = skipped ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'adCountdown',
      scoreDelta: skipped ? 0 : CFG.reward,
      diagnostic: {
        category: 'skip',
        score,
        crimeText:
          skipped && score >= V3_CONFIG.crimeThreshold
            ? `${CFG.reward}ptを捨てて${(elapsedMs / 1000).toFixed(1)}秒でSKIP`
            : undefined,
      },
    })
  }

  return (
    <EventShell>
      <p className="text-sm font-bold text-white/60">＋{CFG.reward} 獲得まで……</p>
      <p className="text-3xl font-black tabular-nums">{secondsLeft}</p>
      <button onClick={() => finish(true)} className="rounded-full bg-white/10 px-6 py-2.5 text-sm font-bold text-white/70">
        SKIP
      </button>
    </EventShell>
  )
}

export function AdCountdownEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.adCountdown}>
      <Content {...props} />
    </EventIntro>
  )
}
