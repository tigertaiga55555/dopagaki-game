import { useState } from 'react'
import { getOverdriveTitle } from '../config/resultTypesV4'
import type { Challenge500State } from '../engine/challenge500Engine'
import { computeChallenge500Result } from '../engine/resultEngineV4'
import { Challenge500IntroScreen } from '../screens/Challenge500IntroScreen'
import { Challenge500Screen } from '../screens/Challenge500Screen'
import { LimitBreakUnlockScreen } from '../screens/LimitBreakUnlockScreen'
import { ResultScreen } from '../screens/ResultScreen'
import { getBestPercent, getPlayCount } from '../utils/storage'
import type { FinalResultV4 } from '../types'

type Phase = 'unlock' | 'intro' | 'active' | 'result'

/**
 * Ver.6 Phase 1 QA補助専用画面（Vercel Previewのみ到達）: ?preview=challenge500
 *
 * 120〜200%の実プレイ・突入演出・200% PERFECT CLEARファンファーレを一切経由せず、
 * 「LIMIT BREAK」ムード転換から直接始める。既存の原則（52.）同様、実際のproduction
 * コンポーネント（LimitBreakUnlockScreen/Challenge500IntroScreen/Challenge500Screen/
 * ResultScreen）をそのまま再利用し、500%チャレンジ本体のロジック・演出・問題は
 * 一切複製・変更しない。
 *
 * 200%到達までの実績が存在しないため、baseResultはこの画面専用の固定ダミー値で構築する
 * （computeFinalTrialResult()は呼ばない。呼ぶとincrementPlayCount/updateBestPercentが
 * 実際に走ってしまうため）。computeChallenge500Result()もpersist=falseで呼び、自己ベストへの
 * 書き込みを防ぐ（bestPercent/playCountの表示は実際の値を読み取るだけで、書き込みは
 * 一切行わない）。Challenge500Screenにはqaモードを渡し、GA4のchallenge_500_start/
 * reach_300/400/500も送信されない。
 *
 * 300%/400%チェックポイント演出・500% ABSOLUTE CLEAR演出は、Challenge500Screen内の
 * QA操作パネル（％ジャンプ・強制正解）で直接見返せる（floorが実際に変化するたびに
 * 演出が再発火するため、ジャンプボタンの操作そのものが演出プレビューを兼ねる）。
 */
export function Challenge500QaPreviewScreen() {
  const [phase, setPhase] = useState<Phase>('unlock')
  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)

  function buildFakeBase(): FinalResultV4 {
    return {
      percent: 200,
      rawPercent: 200,
      overdriveActive: true,
      type: getOverdriveTitle(200),
      comment: '',
      crimeRecords: [],
      maxCombo: 50,
      fastestReactionMs: 430,
      accuracy: 1,
      isFirstPlay: false,
      isNewBest: false,
      bestPercent: getBestPercent(),
      playCount: getPlayCount(),
      finalTrial: { trialsCleared: 16, cleared200: true },
    }
  }

  function restart() {
    setResult(null)
    setPhase('unlock')
    setPlayKey((k) => k + 1)
  }

  /** QA専用: LIMIT BREAK解放演出だけをもう一度最初から見返す（ゲームを進め直す必要がない）。 */
  function replayUnlock() {
    setPhase('unlock')
    setPlayKey((k) => k + 1)
  }

  if (phase === 'result' && result) {
    return <ResultScreen result={result} onRetry={restart} />
  }

  return (
    <div className="relative min-h-dvh">
      <div
        className="pointer-events-none fixed left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full bg-fuchsia-500/20 px-3 py-1 text-[10px] font-black tracking-widest text-fuchsia-200"
        style={{ top: 'calc(env(safe-area-inset-top) + 2.75rem)' }}
      >
        🔧 500% CHALLENGE QA PREVIEW（本番には出ません）
      </div>
      {phase === 'unlock' && (
        <LimitBreakUnlockScreen key={playKey} onQuit={restart} onComplete={() => setPhase('intro')} />
      )}
      {phase === 'intro' && <Challenge500IntroScreen key={playKey} onStart={() => setPhase('active')} onQuit={restart} />}
      {phase === 'active' && (
        <Challenge500Screen
          key={playKey}
          qaMode
          onQuit={restart}
          onFinish={(state: Challenge500State) => {
            setResult(computeChallenge500Result(state, buildFakeBase(), false))
            setPhase('result')
          }}
        />
      )}
      {phase === 'intro' && (
        <button
          onClick={replayUnlock}
          className="fixed bottom-3 right-3 z-[80] rounded-full bg-fuchsia-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg active:scale-90"
        >
          🔧 200演出を見る
        </button>
      )}
    </div>
  )
}
