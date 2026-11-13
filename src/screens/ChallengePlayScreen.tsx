import { useState } from 'react'
import { getOverdriveTitle } from '../config/resultTypesV4'
import { createStats } from '../engine/useRushGame'
import { computeChallenge500Result } from '../engine/resultEngineV4'
import type { Challenge500State } from '../engine/challenge500Engine'
import { Challenge500Screen } from './Challenge500Screen'
import { EndlessPlayScreen } from './EndlessPlayScreen'
import { FinalTrialScreen } from './FinalTrialScreen'
import { PlayScreen } from './PlayScreen'
import { getBestPercent, getPlayCount } from '../utils/storage'
import type { ChallengeRecord } from '../challenge/types'
import type { EndlessDifficulty, FinalResultV4 } from '../types'

interface Props {
  challenge: ChallengeRecord
  /** mode==='normal'|'finalTrial'|'challenge500'の場合に呼ばれる。 */
  onFinish: (result: FinalResultV4) => void
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: mode==='endless'の場合だけ呼ばれる。ENDLESSは
   * DOPA%ベースのFinalResultV4を持たないため、記録したSTREAK数だけを渡す薄いパス。
   */
  onFinishEndless: (streak: number) => void
  onQuit: () => void
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: Challengeへの挑戦プレイを統括する画面。
 * challenge.modeに応じて、既存の本番画面（PlayScreen／FinalTrialScreen／
 * Challenge500Screen）をそのまま再利用し、Challenge専用の偽の画面は一切作らない
 * （既存のPreview QA画面群と同じ「実際のproductionロジック・演出を直接使う」方針）。
 *
 * mode='finalTrial'・'challenge500'は、通常のプレイ経路（0%→120%→200%→500%）を
 * 経由せず、該当ゾーンへ直接入る（既存のFinalTrialPreviewScreen/
 * Challenge500QaPreviewScreenが採用している直接エントリーの仕組みをそのまま使う）。
 * これにより、挑戦者は「作成者がそのモードに到達したのと同じ条件」から始められる。
 *
 * replayQuestionsには常にchallenge.problemSet.itemsを渡す。各hook
 * （useRushGame/useFinalTrial/useChallenge500）は、この配列を使い切るまでは
 * ランダム出題を一切行わない（実際の出題ロジックの変更はしない。問題の供給元を
 * 差し替えるだけ）。
 */
export function ChallengePlayScreen({ challenge, onFinish, onFinishEndless, onQuit }: Props) {
  const [challenge500BaseResult] = useState<FinalResultV4>(() => ({
    percent: 200,
    rawPercent: 200,
    overdriveActive: true,
    type: getOverdriveTitle(200),
    comment: '',
    crimeRecords: [],
    maxCombo: 0,
    fastestReactionMs: null,
    accuracy: 0,
    isFirstPlay: false,
    isNewBest: false,
    bestPercent: getBestPercent(),
    playCount: getPlayCount(),
    finalTrial: { trialsCleared: 16, cleared200: true },
  }))

  if (challenge.mode === 'normal') {
    return <PlayScreen onFinish={onFinish} onQuit={onQuit} replayQuestions={challenge.problemSet.items} />
  }

  if (challenge.mode === 'finalTrial') {
    return (
      <FinalTrialScreen
        initialStats={createStats()}
        onFinish={onFinish}
        onQuit={onQuit}
        replayQuestions={challenge.problemSet.items}
      />
    )
  }

  if (challenge.mode === 'challenge500') {
    return (
      <Challenge500Screen
        onQuit={onQuit}
        replayQuestions={challenge.problemSet.items}
        onFinish={(state: Challenge500State, recordedProblemSet, performanceStats) => {
          onFinish(computeChallenge500Result(state, challenge500BaseResult, true, recordedProblemSet, performanceStats))
        }}
      />
    )
  }

  // mode === 'endless'（Ver.6 Phase 8: ENDLESS Challenge）。
  // qaMode: true は、挑戦者の記録が公式ENDLESS BEST/Ranking/Achievementへ絶対に
  // 反映されないようにするための既存の遮断機構（useEndlessGame.ts参照）。
  // targetStreakにホストのcreatorScore（STREAK数）を渡すと、それを超えた瞬間に
  // 即WIN終了する（そのまま記録を伸ばし続けるモードにはしない）。
  const endlessDifficulty = challenge.conditions.endlessDifficulty as EndlessDifficulty
  return (
    <EndlessPlayScreen
      difficulty={endlessDifficulty}
      qaMode
      replayQuestions={challenge.problemSet.items}
      targetStreak={challenge.creatorScore}
      onFinish={(payload) => onFinishEndless(payload.score)}
      onQuit={onQuit}
    />
  )
}
