import { useCallback, useState } from 'react'
import { MeasureScreen } from './screens/MeasureScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TitleScreen } from './screens/TitleScreen'
import { computeDopagakiResult } from './engine/resultEngineV2'
import type { DopagakiResult, EventOutcome, ScreenName } from './types'

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('title')
  const [result, setResult] = useState<DopagakiResult | null>(null)
  const [playKey, setPlayKey] = useState(0)

  const startMeasuring = useCallback(() => {
    setPlayKey((k) => k + 1)
    setScreen('measuring')
  }, [])

  const handleFinish = useCallback((outcomes: EventOutcome[]) => {
    setResult(computeDopagakiResult(outcomes))
    setScreen('result')
  }, [])

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-[#0b0620]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="bg-blob absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      {screen === 'title' && <TitleScreen onStart={startMeasuring} />}
      {screen === 'measuring' && <MeasureScreen key={playKey} onFinish={handleFinish} />}
      {screen === 'result' && result && <ResultScreen result={result} onRetry={startMeasuring} />}
    </div>
  )
}
