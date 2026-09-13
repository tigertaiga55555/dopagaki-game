import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByElapsed } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { pick } from '../engine/random'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.fakeResult
const REJECTION_MESSAGES = ['早いって。', 'まだ終わってません。']

export function FakeResultEvent({ onComplete }: EventComponentProps) {
  const [rejection, setRejection] = useState<string | null>(null)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), CFG.autoAdvanceMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePress() {
    if (doneRef.current || rejection) return
    const elapsedMs = performance.now() - startRef.current
    const score = scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScorePressed)
    setRejection(pick(REJECTION_MESSAGES))
    setTimeout(() => {
      finishPressed(score, elapsedMs)
    }, CFG.messageMs)
  }

  function finishPressed(score: number, elapsedMs: number) {
    if (doneRef.current) return
    doneRef.current = true
    onComplete({
      eventId: 'fakeResult',
      category: 'result',
      score,
      crimeText: score >= V2_CONFIG.crimeThreshold ? crimeText.fakeResult(elapsedMs / 1000) : undefined,
    })
  }

  function finish(pressed: boolean) {
    if (doneRef.current || pressed) return
    doneRef.current = true
    onComplete({ eventId: 'fakeResult', category: 'result', score: CFG.fallbackScoreIgnored })
  }

  return (
    <EventShell>
      {rejection ? (
        <p className="anim-pop text-lg font-black text-white">{rejection}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-white/60">測定結果が出ました</p>
          <button
            onClick={handlePress}
            className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black text-white"
          >
            結果を見る
          </button>
        </>
      )}
    </EventShell>
  )
}
