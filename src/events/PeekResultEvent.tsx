import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.peekResult

function Content({ ctx, onComplete }: EventComponentProps) {
  const [peeked, setPeeked] = useState(false)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), CFG.windowMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePeek() {
    if (doneRef.current) return
    setPeeked(true)
    setTimeout(() => finish(true), CFG.peekDisplayMs)
  }

  function finish(didPeek: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const score = didPeek ? scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'peekResult',
      scoreDelta: 0,
      diagnostic: {
        category: 'result',
        score,
        crimeText:
          didPeek && score >= V3_CONFIG.crimeThreshold
            ? `残り${Math.round(ctx.getRemainingSeconds())}秒で診断結果をチラ見`
            : undefined,
      },
    })
  }

  return (
    <EventShell>
      {peeked ? (
        <>
          <p className="text-xs font-bold text-white/40">現在のドパガキ度（推定）</p>
          <p className="anim-pop text-6xl font-black">{Math.round(ctx.getCurrentDopagakiEstimate())}%</p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-white/70">現在のドパガキ度を見る</p>
          <button onClick={handlePeek} className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-bold text-white/80">
            見る（2秒消費）
          </button>
        </>
      )}
    </EventShell>
  )
}

export function PeekResultEvent(props: EventComponentProps) {
  return <Content {...props} />
}
