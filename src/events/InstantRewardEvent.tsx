import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.instantReward

function Content({ onComplete }: EventComponentProps) {
  const [waiting, setWaiting] = useState(false)
  const [waitProgress, setWaitProgress] = useState(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    if (!waiting) return
    const start = performance.now()
    let raf: number
    const tick = () => {
      const ratio = Math.min(1, (performance.now() - start) / CFG.waitMs)
      setWaitProgress(ratio)
      if (ratio >= 1) {
        finishWait()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  function finishImmediate() {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const score = scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScoreImmediate)
    onComplete({
      eventId: 'instantReward',
      scoreDelta: CFG.immediateReward,
      diagnostic: {
        category: 'impulse',
        score,
        crimeText:
          score >= V3_CONFIG.crimeThreshold ? `＋${CFG.immediateReward}を${(elapsedMs / 1000).toFixed(1)}秒で即回収` : undefined,
      },
    })
  }

  function finishWait() {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({
      eventId: 'instantReward',
      scoreDelta: CFG.waitReward,
      diagnostic: { category: 'impulse', score: CFG.fallbackScoreWait },
    })
  }

  return (
    <EventShell>
      {!waiting ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onClick={finishImmediate}
            className="rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black text-white"
          >
            今すぐ ＋{CFG.immediateReward}
          </button>
          <button onClick={() => setWaiting(true)} className="rounded-2xl bg-white/10 py-4 text-base font-bold text-white">
            3秒待って ＋{CFG.waitReward}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <p className="mb-2 text-2xl font-black">⏳</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
              style={{ width: `${waitProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </EventShell>
  )
}

export function InstantRewardEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.instantReward}>
      <Content {...props} />
    </EventIntro>
  )
}
