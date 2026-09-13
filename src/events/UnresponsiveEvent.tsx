import { useEffect, useRef } from 'react'
import { V2_CONFIG, scoreByCount } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.unresponsive

export function UnresponsiveEvent({ onComplete }: EventComponentProps) {
  const interactionCountRef = useRef(0)
  const lastMoveAtRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(finish, CFG.totalMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTapLike() {
    if (doneRef.current) return
    interactionCountRef.current += 1
  }

  function handleMoveLike() {
    if (doneRef.current) return
    const now = performance.now()
    // 1回のスワイプで大量のmoveイベントが発火するため、間引いて「1回の操作」として数える
    if (now - lastMoveAtRef.current > 150) {
      lastMoveAtRef.current = now
      interactionCountRef.current += 1
    }
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const count = interactionCountRef.current
    const score = scoreByCount(count, CFG.interactionBands, CFG.fallbackScore)
    onComplete({
      eventId: 'unresponsive',
      category: 'impatience',
      score,
      crimeText: score >= V2_CONFIG.crimeThreshold ? crimeText.unresponsive(count) : undefined,
    })
  }

  return (
    <div onPointerDown={handleTapLike} onPointerMove={handleMoveLike} className="touch-none select-none">
      <EventShell>
        <p className="text-3xl text-white/30">……</p>
      </EventShell>
    </div>
  )
}
