import { useCallback, useState } from 'react'
import { GameScreen } from './screens/GameScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TitleScreen } from './screens/TitleScreen'
import { incrementPlayCount } from './utils/storage'
import { buildGameResult } from './utils/resultBuilder'
import type { EngineResult } from './engine/useGameEngine'
import type { GameResult, ScreenName } from './types'

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('title')
  const [result, setResult] = useState<GameResult | null>(null)
  const [gameKey, setGameKey] = useState(0)

  const startGame = useCallback(() => {
    setGameKey((k) => k + 1)
    setScreen('playing')
  }, [])

  const handleEnd = useCallback((engineResult: EngineResult) => {
    incrementPlayCount()
    const built = buildGameResult(engineResult.finalPoint, engineResult.maxPoint, engineResult.isAuto)
    setResult(built)
    setScreen('result')
  }, [])

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-[#0b0620]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="bg-blob absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      {screen === 'title' && <TitleScreen onStart={startGame} />}
      {screen === 'playing' && <GameScreen key={gameKey} onEnd={handleEnd} />}
      {screen === 'result' && result && (
        <ResultScreen result={result} onRetry={startGame} />
      )}
    </div>
  )
}
