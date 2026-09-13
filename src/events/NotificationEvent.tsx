import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { randFloat } from '../engine/random'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.notification

export function NotificationEvent({ onComplete }: EventComponentProps) {
  const [visible, setVisible] = useState(false)
  const shownAtRef = useRef<number>(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const delay = randFloat(CFG.showDelayMinMs, CFG.showDelayMaxMs)
    const showTimer = setTimeout(() => {
      shownAtRef.current = performance.now()
      setVisible(true)
    }, delay)

    const autoTimer = setTimeout(() => {
      finish(false)
    }, delay + CFG.autoAdvanceMs)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(autoTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(opened: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = shownAtRef.current ? performance.now() - shownAtRef.current : CFG.autoAdvanceMs
    const score = opened ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'notification',
      category: 'notification',
      score,
      crimeText: opened && score >= V2_CONFIG.crimeThreshold ? crimeText.notification(elapsedMs / 1000) : undefined,
    })
  }

  return (
    <EventShell>
      <p className="text-sm text-white/50">いつも通り操作してください。</p>
      {visible && (
        <button
          onClick={() => finish(true)}
          className="anim-pop absolute left-4 right-4 top-6 flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left backdrop-blur-md"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 text-sm font-black">
            !
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white">新着メッセージ 1件</span>
            <span className="block truncate text-xs text-white/60">あなたへの通知があります</span>
          </span>
        </button>
      )}
    </EventShell>
  )
}
