import { useEffect, useRef, useState } from 'react'
import { V2_CONFIG, scoreByCount } from '../config/gameConfigV2'
import { crimeText } from '../config/messagesV2'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V2_CONFIG.events.rapidTap

export function RapidTapEvent({ onComplete }: EventComponentProps) {
  const [enabled, setEnabled] = useState(false)
  const preTapCountRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setEnabled(true), CFG.enableMs)
    return () => clearTimeout(timer)
  }, [])

  function handlePointerDown() {
    if (doneRef.current) return
    if (!enabled) {
      preTapCountRef.current += 1
      return
    }
    finish()
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const count = preTapCountRef.current
    const score = scoreByCount(count, CFG.tapBands, CFG.fallbackScore)
    onComplete({
      eventId: 'rapidTap',
      category: 'impulse',
      score,
      crimeText: score >= V2_CONFIG.crimeThreshold ? crimeText.rapidTap(count) : undefined,
    })
  }

  return (
    <EventShell>
      <p className="text-sm font-bold text-white/60">次の画面に進みましょう。</p>
      <button
        onPointerDown={handlePointerDown}
        className={`w-full max-w-xs rounded-2xl py-5 text-lg font-black text-white transition-transform ${
          enabled
            ? 'bg-gradient-to-b from-fuchsia-500 to-purple-600 active:translate-y-1'
            : 'bg-gradient-to-b from-fuchsia-500/50 to-purple-600/50'
        }`}
      >
        次へ
      </button>
    </EventShell>
  )
}
