import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByCount } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.comboBoost

function Content({ onComplete }: EventComponentProps) {
  const [progress, setProgress] = useState(0)
  const [pulseKey, setPulseKey] = useState(0)
  const tapCountRef = useRef(0)
  const extraPercentRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const start = performance.now()
    let raf: number
    const tick = () => {
      const elapsed = performance.now() - start
      const autoPercent = Math.min(100, (elapsed / CFG.autoFillMs) * 100)
      const total = Math.min(100, autoPercent + extraPercentRef.current)
      setProgress(total)
      if (total >= 100) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTap() {
    if (doneRef.current) return
    tapCountRef.current += 1
    extraPercentRef.current += CFG.tapBoostPercent
    setPulseKey((k) => k + 1)
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const count = tapCountRef.current
    const score = scoreByCount(count, CFG.tapBands, CFG.fallbackScore)
    onComplete({
      eventId: 'comboBoost',
      scoreDelta: CFG.reward,
      diagnostic: {
        category: 'impulse',
        score,
        crimeText: score >= V3_CONFIG.crimeThreshold ? `ゲージを${count}回連打` : undefined,
      },
    })
  }

  return (
    <div onPointerDown={handleTap} className="cursor-pointer">
      <EventShell>
        <div key={pulseKey} className="anim-spike h-20 w-20 rounded-full bg-gradient-to-b from-fuchsia-500 to-purple-600" />
        <div className="w-full max-w-xs">
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums">{Math.floor(progress)}%</p>
        </div>
        <p className="text-xs text-white/40">タップすると少し速くなる</p>
      </EventShell>
    </div>
  )
}

export function ComboBoostEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.comboBoost}>
      <Content {...props} />
    </EventIntro>
  )
}
