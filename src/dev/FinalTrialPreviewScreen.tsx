import { useState } from 'react'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { FinalTrialScreen } from '../screens/FinalTrialScreen'
import { ResultScreen } from '../screens/ResultScreen'
import type { FinalResultV4, PlayStats } from '../types'

/**
 * Vercel Previewでのみ到達できる、Ver.5.0 FINAL DOPA TRIAL以降を確認するための3モード共通画面。
 *
 * 52. 「Previewは実際のproductionコンポーネントを直接再利用し、Preview専用の偽物演出は
 * 作らない」という既存の原則をそのまま踏襲する：ここで表示しているのは実際の本番画面
 * （src/screens/FinalTrialScreen.tsx）そのものであり、この画面は「どのquestionNumberから
 * 始めるか」「⏩強制正解ボタンを出すか」というパラメータを渡しているだけで、
 * ゲームロジック・演出コンポーネント・結果画面（ResultScreen/ResultCard）は一切複製しない。
 *
 * - finaltrial: 120%到達→FINAL DOPA TRIAL突入演出→Q1から実際にプレイ可能
 * - finalquestion: 195%から開始し、FINAL QUESTION（箱シャッフル）を実際に回答可能な状態で確認
 * - clear200: 195%から開始し、FINAL QUESTIONを自動で正解扱いにして200%真のPERFECT CLEAR演出
 *   （ゲーム最大の演出）と専用結果画面を確認できる
 */
export type FinalPreviewMode = 'finaltrial' | 'finalquestion' | 'clear200'

const FAKE_STATS: PlayStats = {
  totalAnswered: 50,
  correctCount: 50,
  missCount: 0,
  maxCombo: 50,
  reactionSamples: [],
  fastestReactionMs: 430,
  noPressTotal: 0,
  noPressFails: 0,
  hastyTapCount: 0,
  maxTapsInOneSecond: 1,
  comboLostToNoPress: 0,
  typeStats: {},
  earlyPressCount: 0,
  overPressCount: 0,
  stopAt100Samples: [],
  notificationClearSamples: [],
  rapidStopRedTaps: 0,
  sequenceTapSamples: [],
  findTargetSamples: [],
  releaseZoneOverMs: [],
  shortVideoSamples: [],
  colorWordFooledCount: 0,
  notifRushSamples: [],
}

const MODE_LABEL: Record<FinalPreviewMode, string> = {
  finaltrial: '🔧 FINAL DOPA TRIAL PREVIEW（本番には出ません）',
  finalquestion: '🔧 FINAL QUESTION PREVIEW（本番には出ません）',
  clear200: '🔧 200% CLEAR PREVIEW（本番には出ません）',
}

export function FinalTrialPreviewScreen({ mode }: { mode: FinalPreviewMode }) {
  const [result, setResult] = useState<FinalResultV4 | null>(null)
  const [playKey, setPlayKey] = useState(0)

  if (result) {
    return (
      <ResultScreen
        result={result}
        onRetry={() => {
          setResult(null)
          setPlayKey((k) => k + 1)
        }}
      />
    )
  }

  const startAtQuestion = mode === 'finaltrial' ? 1 : FINAL_TRIAL_CONFIG.totalQuestions

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed bottom-2 left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full bg-fuchsia-500/20 px-3 py-1 text-[10px] font-black tracking-widest text-fuchsia-200">
        {MODE_LABEL[mode]}
      </div>
      <FinalTrialScreen
        key={playKey}
        initialStats={FAKE_STATS}
        startAtQuestion={startAtQuestion}
        showForceCorrect
        autoForceCorrectDelayMs={mode === 'clear200' ? 900 : undefined}
        onFinish={setResult}
      />
    </div>
  )
}
