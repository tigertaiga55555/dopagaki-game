import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.instantReward

export function InstantRewardEvent({ onComplete }: EventComponentProps) {
  const [waiting, setWaiting] = useState(false)
  const [waitProgress, setWaitProgress] = useState(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    // 何も選ばずに放置された場合の保険（実際に「待つ」を選んだ場合は5秒後に先に完了する）
    const timeout = setTimeout(() => finishTimeout(), CFG.autoTimeoutMs)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      category: 'impulse',
      score,
      crimeText: score >= V2_CONFIG.crimeThreshold ? crimeText.instantReward(elapsedMs / 1000) : undefined,
    })
  }

  function finishWait() {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({ eventId: 'instantReward', category: 'impulse', score: CFG.waitScore })
  }

  function finishTimeout() {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({ eventId: 'instantReward', category: 'impulse', score: CFG.timeoutScore })
  }

  return (
    <EventShell>
      <p className="text-sm font-bold text-white/60">どちらか選んでください。</p>
      {!waiting ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onClick={finishImmediate}
            className="rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black text-white"
          >
            今すぐ 10コイン
          </button>
          <button
            onClick={() => setWaiting(true)}
            className="rounded-2xl bg-white/10 py-4 text-base font-bold text-white"
          >
            5秒待つと 100コイン
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
