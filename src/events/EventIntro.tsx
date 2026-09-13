import { useEffect, useState, type ReactNode } from 'react'
import { V3_CONFIG } from '../config/gameConfigV3'
import { EventShell } from './EventShell'

interface Props {
  text: string
  children: ReactNode
}

/** 各イベント開始時に「何をすればいいか」を短く見せてから、本体（children）を表示する共通ラッパー */
export function EventIntro({ text, children }: Props) {
  const [showingIntro, setShowingIntro] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowingIntro(false), V3_CONFIG.introDurationMs)
    return () => clearTimeout(timer)
  }, [])

  if (showingIntro) {
    return (
      <EventShell>
        <p className="anim-pop text-3xl font-black leading-snug text-white">{text}</p>
      </EventShell>
    )
  }

  return <>{children}</>
}
