import { useState } from 'react'
import { getOverdriveTitle } from '../config/resultTypesV4'
import type { EndlessState } from '../engine/endlessChallenge'
import { computeEndlessResult } from '../engine/resultEngineV4'
import { Challenge500IntroScreen } from '../screens/Challenge500IntroScreen'
import { Challenge500Screen } from '../screens/Challenge500Screen'
import { ResultScreen } from '../screens/ResultScreen'
import { getBestPercent, getPlayCount } from '../utils/storage'
import type { FinalResultV4 } from '../types'

type Phase = 'intro' | 'active' | 'result'

/**
 * Ver.6 Phase 1 QA補助専用画面（Vercel Previewのみ到達）: ?preview=challenge500
 *
 * 120〜200%の実プレイ・突入演出・200% PERFECT CLEARファンファーレを一切経由せず、
 * 「500%に挑戦」説明画面から直接始める。既存の原則（52.）同様、実際のproduction
 * コンポーネント（Challenge500IntroScreen/Challenge500Screen/ResultScreen）をそのまま
 * 再利用し、500%チャレンジ本体のロジック・演出・問題は一切複製・変更しない。
 *
 * 200%到達までの実績が存在しないため、baseResultはこの画面専用の固定ダミー値で構築する
 * （computeFinalTrialResult()は呼ばない。呼ぶとincrementPlayCount/updateBestPercentが
 * 実際に走ってしまうため）。computeEndlessResult()もpersist=falseで呼び、自己ベストへの
 * 書き込みを防ぐ（bestPercent/playCountの表示は実際の値を読み取るだけで、書き込みは
 * 一切行わない）。Challenge500Screenにはqaモードを渡し、GA4のchallenge_500_start/
 * reach_300/400/500も送信されない。
 */
export function Challenge500QaPreviewScreen() {
  const [phase, setPhase] = useState<Phase>('intro')
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
    setPhase('intro')
    setPlayKey((k) => k + 1)
  }

  if (phase === 'result' && result) {
    return <ResultScreen result={result} onRetry={restart} />
  }

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed bottom-16 left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full bg-fuchsia-500/20 px-3 py-1 text-[10px] font-black tracking-widest text-fuchsia-200">
        🔧 500% CHALLENGE QA PREVIEW（本番には出ません）
      </div>
      {phase === 'intro' && <Challenge500IntroScreen key={playKey} onStart={() => setPhase('active')} onQuit={restart} />}
      {phase === 'active' && (
        <Challenge500Screen
          key={playKey}
          qaMode
          onQuit={restart}
          onFinish={(state: EndlessState) => {
            setResult(computeEndlessResult(state, buildFakeBase(), false))
            setPhase('result')
          }}
        />
      )}
    </div>
  )
}
