import { useRef, useState } from 'react'
import { V2_CONFIG } from '../config/gameConfigV2'
import { TAUNTS_BY_EVENT } from '../config/messagesV2'
import { EVENT_COMPONENTS } from '../events'
import { buildEventSequence } from '../engine/eventPool'
import { pick } from '../engine/random'
import type { EventOutcome } from '../types'

interface Props {
  onFinish: (outcomes: EventOutcome[]) => void
}

export function MeasureScreen({ onFinish }: Props) {
  const [sequence] = useState(() => buildEventSequence())
  const [index, setIndex] = useState(0)
  const [taunt, setTaunt] = useState<string | null>(null)
  const outcomesRef = useRef<EventOutcome[]>([])

  const progressPercent = Math.round((index / sequence.length) * 100)
  const currentEventId = sequence[index]
  const CurrentEvent = EVENT_COMPONENTS[currentEventId]

  function advance() {
    if (index + 1 >= sequence.length) {
      onFinish(outcomesRef.current)
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleEventComplete(outcome: EventOutcome) {
    outcomesRef.current = [...outcomesRef.current, outcome]

    const tauntPool = TAUNTS_BY_EVENT[outcome.eventId]
    if (outcome.score >= V2_CONFIG.tauntThreshold && tauntPool && tauntPool.length > 0) {
      setTaunt(pick(tauntPool))
      setTimeout(() => {
        setTaunt(null)
        advance()
      }, V2_CONFIG.tauntDurationMs)
    } else {
      advance()
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="flex items-center justify-center px-4 pt-3 pb-1">
        <p className="text-[11px] font-bold tracking-widest text-white/30">測定中 {progressPercent}%</p>
      </div>

      {taunt ? (
        <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col items-center justify-center px-6 text-center">
          <p className="anim-pop text-2xl font-black leading-snug text-white">{taunt}</p>
        </div>
      ) : (
        <CurrentEvent key={`${currentEventId}-${index}`} onComplete={handleEventComplete} />
      )}
    </div>
  )
}
