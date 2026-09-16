import { useCallback, useState } from 'react'
import { OverdrivePreviewScreen } from './dev/OverdrivePreviewScreen'
import { isOverdrivePreviewRequested } from './dev/overdrivePreview'
import { PlayScreen } from './screens/PlayScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TitleScreen } from './screens/TitleScreen'
import { unlockAudio } from './utils/audioContext'
import { sfx } from './utils/sound'
import { computeFinalResult } from './engine/resultEngineV4'
import type { RushFinishPayload } from './engine/useRushGame'
import type { FinalResultV4, ScreenName } from './types'

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('title')
  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)
  // Vercel Previewかつ ?preview=overdrive の場合のみ、通常のタイトル/プレイ/結果の
  // 画面遷移を完全にバイパスして確認用画面を表示する。Productionでは
  // isOverdrivePreviewRequested()が常にfalseを返すため、この分岐には到達しない。
  const [showOverdrivePreview] = useState(isOverdrivePreviewRequested)

  const startPlay = useCallback(() => {
    // iPhone SafariはAudioContextの生成/resumeをユーザー操作の同期コールバック内でしか許可しないため、
    // START/リトライの両方で使われるこのハンドラの中で必ず呼ぶ。
    unlockAudio()
    sfx.startPress()
    setPlayKey((k) => k + 1)
    setScreen('playing')
  }, [])

  const handleFinish = useCallback((payload: RushFinishPayload) => {
    setResult(computeFinalResult(payload))
    setScreen('result')
  }, [])

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#0b0620]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="bg-blob absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      {showOverdrivePreview ? (
        <OverdrivePreviewScreen />
      ) : (
        <>
          {screen === 'title' && <TitleScreen onStart={startPlay} />}
          {screen === 'playing' && <PlayScreen key={playKey} onFinish={handleFinish} />}
          {screen === 'result' && result && <ResultScreen result={result} onRetry={startPlay} />}
        </>
      )}
    </div>
  )
}
