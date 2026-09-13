import { useEffect, useMemo, useRef, useState } from 'react'
import { V3_CONFIG } from '../config/gameConfigV3'
import { EVENT_COMPONENTS } from '../events'
import { buildEventSequence } from '../engine/eventPoolV3'
import type { DiagnosticOutcome, EventResult, PlayContext } from '../types'

interface Props {
  onFinish: (payload: { gameScore: number; diagnostics: DiagnosticOutcome[] }) => void
}

interface Popup {
  id: number
  text: string
  positive: boolean
}

export function PlayScreen({ onFinish }: Props) {
  const [sequence] = useState(() => buildEventSequence())
  const [index, setIndex] = useState(0)
  const [gameScore, setGameScore] = useState(0)
  const [remainingMs, setRemainingMs] = useState(V3_CONFIG.totalTimeMs)
  const [popups, setPopups] = useState<Popup[]>([])

  const startRef = useRef(performance.now())
  const gameScoreRef = useRef(0)
  const diagnosticsRef = useRef<DiagnosticOutcome[]>([])
  const timeUpRef = useRef(false)
  const popupIdRef = useRef(0)
  const finishedRef = useRef(false)

  useEffect(() => {
    let raf: number
    const tick = () => {
      const elapsed = performance.now() - startRef.current
      const remaining = Math.max(0, V3_CONFIG.totalTimeMs - elapsed)
      setRemainingMs(remaining)
      if (remaining <= 0) timeUpRef.current = true
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const ctx: PlayContext = useMemo(
    () => ({
      getRemainingSeconds: () => Math.max(0, (V3_CONFIG.totalTimeMs - (performance.now() - startRef.current)) / 1000),
      getCurrentDopagakiEstimate: () => {
        const diags = diagnosticsRef.current
        if (diags.length === 0) return 0
        let sum = 0
        let weight = 0
        for (const d of diags) {
          const w = d.weight ?? 1
          sum += d.score * w
          weight += w
        }
        return weight > 0 ? sum / weight : 0
      },
    }),
    [],
  )

  function handleEventComplete(result: EventResult) {
    gameScoreRef.current += result.scoreDelta
    setGameScore(gameScoreRef.current)

    if (result.scoreDelta !== 0) {
      const id = popupIdRef.current++
      setPopups((prev) => [
        ...prev,
        { id, text: `${result.scoreDelta > 0 ? '+' : ''}${result.scoreDelta}`, positive: result.scoreDelta > 0 },
      ])
      setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id))
      }, V3_CONFIG.popupDurationMs)
    }

    if (result.diagnostic) {
      diagnosticsRef.current = [...diagnosticsRef.current, result.diagnostic]
    }

    if (finishedRef.current) return
    if (index + 1 >= sequence.length || timeUpRef.current) {
      finishedRef.current = true
      onFinish({ gameScore: gameScoreRef.current, diagnostics: diagnosticsRef.current })
    } else {
      setIndex((i) => i + 1)
    }
  }

  const currentEventId = sequence[index]
  const CurrentEvent = EVENT_COMPONENTS[currentEventId]

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="flex items-start justify-between px-5 pt-3 pb-1">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-white/40">GAME SCORE</p>
          <p className="text-xl font-black tabular-nums text-white">{gameScore.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/40">TIME</p>
          <p className="text-xl font-black tabular-nums text-white">{(remainingMs / 1000).toFixed(1)}</p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex flex-col items-center gap-1">
        {popups.map((p) => (
          <span key={p.id} className={`anim-popup-float text-3xl font-black ${p.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {p.text}
          </span>
        ))}
      </div>

      <CurrentEvent key={`${currentEventId}-${index}`} ctx={ctx} onComplete={handleEventComplete} />
    </div>
  )
}
