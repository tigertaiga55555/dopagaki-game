import { useCallback, useState } from 'react'
import { Challenge500QaPreviewScreen } from './dev/Challenge500QaPreviewScreen'
import { EndlessPreviewScreen } from './dev/EndlessPreviewScreen'
import { FinalTrialPreviewScreen } from './dev/FinalTrialPreviewScreen'
import { OverdrivePreviewScreen } from './dev/OverdrivePreviewScreen'
import {
  isChallenge500QaPreviewRequested,
  isClear200PreviewRequested,
  isEndlessPreviewRequested,
  isFinalQuestionPreviewRequested,
  isFinalTrialPreviewRequested,
  isOverdrivePreviewRequested,
} from './dev/overdrivePreview'
import type { EndlessFinishPayload } from './engine/useEndlessGame'
import { EndlessPlayScreen } from './screens/EndlessPlayScreen'
import { EndlessResultScreen } from './screens/EndlessResultScreen'
import { EndlessSelectScreen } from './screens/EndlessSelectScreen'
import { PlayScreen } from './screens/PlayScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TitleScreen } from './screens/TitleScreen'
import { trackGameStart, trackReplayStart } from './utils/analytics'
import { unlockAudio } from './utils/audioContext'
import { sfx } from './utils/sound'
import type { EndlessDifficulty, FinalResultV4, ScreenName } from './types'

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('title')
  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)
  // Ver.6 Phase 4: Endless専用の状態。通常ゲーム（screen/result/playKey）とは
  // 完全に独立させており、互いの画面遷移には一切影響しない。
  const [endlessDifficulty, setEndlessDifficulty] = useState<EndlessDifficulty>('beginner')
  const [endlessResult, setEndlessResult] = useState<EndlessFinishPayload | null>(null)
  const [endlessPlayKey, setEndlessPlayKey] = useState(0)
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
  // Ver.6 Phase 1 QA補助: ?preview=challenge500 の場合のみ、120〜200%の実プレイ・突入演出を
  // 一切経由せず「500%に挑戦」説明画面から直接始められるQA専用画面を表示する。
  const [showChallenge500QaPreview] = useState(isChallenge500QaPreviewRequested)
  // Ver.6 Phase 4 QA補助: ?preview=endless の場合のみ、Endlessの難易度選択画面から
  // 直接始められるQA専用画面を表示する。
  const [showEndlessPreview] = useState(isEndlessPreviewRequested)

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

  /**
   * Ver.6準備: 画面右上の「やめる」ボタン用。onFinishを一切経由せずscreenを'title'へ
   * 戻すだけなので、結果計算（computeFinalResult等）もスコア保存（incrementPlayCount/
   * updateBestPercent、いずれもresultEngineV4.ts内でonFinish経由でのみ呼ばれる）も
   * 一切発生しない。PlayScreen（useRushGame）・FinalTrialScreen（useFinalTrial）は
   * このタイミングでアンマウントされ、両hookが既に持つuseEffectクリーンアップ
   * （RAFキャンセル・タイマー全クリア・BGM停止）がそのまま働くため、追加の後片付けは不要。
   */
  const quitToHome = useCallback(() => {
    setScreen('title')
  }, [])

  /**
   * Ver.6 Phase 4: ホーム画面の「ENDLESS」ボタン用。通常ゲームのstartPlayとは別経路
   * （unlockAudio/sfx.startPressは共有するが、trackGameStart/trackReplayStartは
   * Endless専用のtrackEndlessStart（useEndlessGame.ts側）と別イベントのため送らない）。
   */
  const openEndlessSelect = useCallback(() => {
    unlockAudio()
    sfx.startPress()
    setScreen('endlessSelect')
  }, [])

  const startEndless = useCallback((difficulty: EndlessDifficulty) => {
    setEndlessDifficulty(difficulty)
    setEndlessPlayKey((k) => k + 1)
    setScreen('endlessPlaying')
  }, [])

  const handleEndlessFinish = useCallback((payload: EndlessFinishPayload) => {
    setEndlessResult(payload)
    setScreen('endlessResult')
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
      ) : showChallenge500QaPreview ? (
        <Challenge500QaPreviewScreen />
      ) : showEndlessPreview ? (
        <EndlessPreviewScreen />
      ) : (
        <>
          {screen === 'title' && <TitleScreen onStart={() => startPlay('title')} onStartEndless={openEndlessSelect} />}
          {screen === 'playing' && <PlayScreen key={playKey} onFinish={handleFinish} onQuit={quitToHome} />}
          {screen === 'result' && result && <ResultScreen result={result} onRetry={() => startPlay('retry')} />}
          {screen === 'endlessSelect' && <EndlessSelectScreen onSelect={startEndless} onQuit={quitToHome} />}
          {screen === 'endlessPlaying' && (
            <EndlessPlayScreen key={endlessPlayKey} difficulty={endlessDifficulty} onFinish={handleEndlessFinish} onQuit={quitToHome} />
          )}
          {screen === 'endlessResult' && endlessResult && (
            <EndlessResultScreen
              difficulty={endlessDifficulty}
              score={endlessResult.score}
              best={endlessResult.best}
              isNewBest={endlessResult.isNewBest}
              onRetry={() => startEndless(endlessDifficulty)}
              onChangeDifficulty={() => setScreen('endlessSelect')}
              onHome={quitToHome}
            />
          )}
        </>
      )}
    </div>
  )
}
