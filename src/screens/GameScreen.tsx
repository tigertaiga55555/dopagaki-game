import { useEffect, useState } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import { MessageBanner } from '../components/MessageBanner'
import { PointDisplay } from '../components/PointDisplay'
import { useGameEngine, type EngineResult } from '../engine/useGameEngine'

interface Props {
  onEnd: (result: EngineResult) => void
}

export function GameScreen({ onEnd }: Props) {
  const { snapshot, confirm } = useGameEngine(onEnd)
  const [overlay, setOverlay] = useState<'red' | 'green' | null>(null)

  useEffect(() => {
    if (snapshot.effect === 'crash') {
      setOverlay('red')
    } else if (
      snapshot.effect === 'spike' ||
      snapshot.effect === 'bonus' ||
      snapshot.effect === 'recover'
    ) {
      setOverlay('green')
    } else {
      return
    }
    const timer = setTimeout(() => setOverlay(null), 600)
    return () => clearTimeout(timer)
  }, [snapshot.effectKey, snapshot.effect])

  return (
    <div className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 py-8">
      {overlay && (
        <div
          className={`pointer-events-none fixed inset-0 z-30 ${overlay === 'red' ? 'flash-red-overlay' : 'flash-green-overlay'}`}
        />
      )}

      <div className="pt-6">
        <PointDisplay
          currentPoint={snapshot.displayPoint}
          maxPoint={snapshot.maxPoint}
          effect={snapshot.effect}
          effectKey={snapshot.effectKey}
        />
      </div>

      <MessageBanner message={snapshot.message} effectKey={snapshot.effectKey} />

      <div className="pb-4">
        <ConfirmButton point={Math.round(snapshot.displayPoint)} onConfirm={confirm} />
      </div>
    </div>
  )
}
