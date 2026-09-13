import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { randInt } from '../engine/random'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.treasureBox

function Content({ onComplete }: EventComponentProps) {
  const [hinted, setHinted] = useState(false)
  const winningBoxRef = useRef(randInt(0, 2))
  const revealedWrongRef = useRef<number | null>(null)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      const options = [0, 1, 2].filter((i) => i !== winningBoxRef.current)
      revealedWrongRef.current = options[randInt(0, options.length - 1)]
      setHinted(true)
    }, CFG.hintDelayMs)
    return () => clearTimeout(timer)
  }, [])

  function handlePick(index: number) {
    if (doneRef.current || index === revealedWrongRef.current) return
    doneRef.current = true
    const elapsedMs = performance.now() - startRef.current
    const correct = index === winningBoxRef.current
    const score = scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore)
    onComplete({
      eventId: 'treasureBox',
      scoreDelta: correct ? CFG.reward : 0,
      diagnostics: [
        {
          category: 'impulse',
          score,
          crimeText: score >= V3_CONFIG.crimeThreshold ? `ヒントを待たず${(elapsedMs / 1000).toFixed(1)}秒で箱を選択` : undefined,
        },
      ],
    })
  }

  return (
    <EventShell>
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => {
          const isWrongRevealed = hinted && revealedWrongRef.current === i
          return (
            <button
              key={i}
              onClick={() => handlePick(i)}
              disabled={isWrongRevealed}
              className={`flex h-24 w-20 items-center justify-center rounded-2xl text-4xl transition-opacity ${
                isWrongRevealed ? 'bg-white/5 opacity-30' : 'bg-white/10'
              }`}
            >
              📦
            </button>
          )
        })}
      </div>
      {hinted && <p className="text-xs text-white/40">ハズレが1つ消えた</p>}
    </EventShell>
  )
}

export function TreasureBoxEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.treasureBox}>
      <Content {...props} />
    </EventIntro>
  )
}
