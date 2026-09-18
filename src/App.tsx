import { useCallback, useState } from 'react'
import { FinalTrialPreviewScreen } from './dev/FinalTrialPreviewScreen'
import { OverdrivePreviewScreen } from './dev/OverdrivePreviewScreen'
import {
  isClear200PreviewRequested,
  isFinalQuestionPreviewRequested,
  isFinalTrialPreviewRequested,
  isOverdrivePreviewRequested,
} from './dev/overdrivePreview'
import { PlayScreen } from './screens/PlayScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TitleScreen } from './screens/TitleScreen'
import { trackGameStart, trackReplayStart } from './utils/analytics'
import { unlockAudio } from './utils/audioContext'
import { sfx } from './utils/sound'
import type { FinalResultV4, ScreenName } from './types'

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('title')
  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)
  // Vercel Previewかつ ?preview=overdrive の場合のみ、通常のタイトル/プレイ/結果の
  // 画面遷移を完全にバイパスして確認用画面を表示する。Productionでは
  // isOverdrivePreviewRequested()が常にfalseを返すため、この分岐には到達しない。
  const [showOverdrivePreview] = useState(isOverdrivePreviewRequested)
  // Ver.5.0: 同様に ?preview=finaltrial / finalquestion / clear200 の場合のみ、
  // FINAL DOPA TRIAL以降を確認する専用画面を表示する（51. 旧?preview=clear120は
  // 120%がもはやCLEARではなくなったため廃止し、finaltrialへ整理した）。
  const [showFinalTrialPreview] = useState(isFinalTrialPreviewRequested)
  const [showFinalQuestionPreview] = useState(isFinalQuestionPreviewRequested)
  const [showClear200Preview] = useState(isClear200PreviewRequested)

  /**
   * Ver.5.0追加: GA4のgame_start（常に）とreplay_start（結果画面からのリトライ時のみ）を
   * ここで送信する。sourceはこの関数の呼び出し元（タイトルのSTART / 結果画面のリトライ）を
   * 区別するためだけの引数で、ゲームの開始処理自体（unlockAudio/sfx/画面遷移）は
   * sourceに関わらず完全に同一。
   */
  const startPlay = useCallback((source: 'title' | 'retry') => {
    // iPhone SafariはAudioContextの生成/resumeをユーザー操作の同期コールバック内でしか許可しないため、
    // START/リトライの両方で使われるこのハンドラの中で必ず呼ぶ。
    unlockAudio()
    sfx.startPress()
    trackGameStart()
    if (source === 'retry') trackReplayStart()
    setPlayKey((k) => k + 1)
    setScreen('playing')
  }, [])

  const handleFinish = useCallback((result: FinalResultV4) => {
    setResult(result)
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
      ) : showFinalTrialPreview ? (
        <FinalTrialPreviewScreen mode="finaltrial" />
      ) : showFinalQuestionPreview ? (
        <FinalTrialPreviewScreen mode="finalquestion" />
      ) : showClear200Preview ? (
        <FinalTrialPreviewScreen mode="clear200" />
      ) : (
        <>
          {screen === 'title' && <TitleScreen onStart={() => startPlay('title')} />}
          {screen === 'playing' && <PlayScreen key={playKey} onFinish={handleFinish} />}
          {screen === 'result' && result && <ResultScreen result={result} onRetry={() => startPlay('retry')} />}
        </>
      )}
    </div>
  )
}
