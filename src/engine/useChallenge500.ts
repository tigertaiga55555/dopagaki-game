import { useRef, useState } from 'react'
import { applyCorrect, applyMiss, createChallenge500State, createChallenge500StateAt, type Challenge500State } from './challenge500Engine'
import { pickChallenge500Question } from '../questions/challenge500'
import { trackChallenge500Start, trackReach300, trackReach400, trackReach500 } from '../utils/analytics'
import type { ChallengeProblemSetItem } from '../challenge/types'
import type { Challenge500QuestionResult, Challenge500QuestionSpec } from '../questions/challenge500/types'

/** Ver.6 Phase 5.2（Challenge機能完成）: 1件のChallengeへ保存する問題数の上限（Worker側validation.tsと同じ値）。 */
const MAX_RECORDED_PROBLEMS = 300

export function specToProblemSetItem(spec: Challenge500QuestionSpec): ChallengeProblemSetItem {
  return { type: spec.type, data: spec.data }
}

let replaySpecCounter = 0
export function problemSetItemToSpec(item: ChallengeProblemSetItem): Challenge500QuestionSpec {
  replaySpecCounter += 1
  return { instanceId: `challenge500-replay-${replaySpecCounter}`, type: item.type, data: item.data }
}

/** Ver.6 Phase 5.3（Challenge勝敗判定強化）: Challenge用performance集計の形。getPerformanceStats()の戻り値。 */
export interface Challenge500PerformanceStats {
  totalAnswered: number
  correctCount: number
  maxCombo: number
  reactionMsList: number[]
}

export interface Challenge500Snapshot {
  state: Challenge500State
  currentSpec: Challenge500QuestionSpec | null
}

export interface UseChallenge500Options {
  /**
   * Preview/development専用のQA補助モード。trueの場合、challenge_500_start・
   * reach_300・reach_400・reach_500のGA4送信をすべて抑制する（ジャンプ・強制正解/MISSの
   * どの操作で到達した場合も、実際のプレイ到達として記録しない）。本番コードパスからは
   * 絶対にtrueを渡さない（呼び出し元のChallenge500Screen側で__DOPAGAKI_PREVIEW_ENABLED__
   * によるビルド時ガードと二重に守られている）。
   */
  qaMode?: boolean
  /**
   * Ver.6 Phase 5.2（Challenge機能完成）: 指定されると、pickChallenge500Question
   * によるランダム出題の代わりにこの配列を順番に出題する（Challenge挑戦時、作成者と
   * 完全に同じ問題・同じ順番で再生するために使う）。配列を使い切った後は、
   * 元々の問題生成ロジックへ自動的にフォールバックする（挑戦者が作成者より速く
   * 先へ進んだ場合など、記録済みの範囲を超えた分はランダム出題で続行する）。
   */
  replayQuestions?: ChallengeProblemSetItem[]
}

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の画面用エンジン。
 * 数値ロジック（challenge500Challenge.ts）・問題生成（questions/challenge500）・GA4の
 * 到達イベント送信（1プレイにつき1回だけ、既存のuseRushGame/useFinalTrialと
 * 同じ「ref一発ガード」方式）を1箇所にまとめる。
 */
export function useChallenge500(onFinish: (state: Challenge500State) => void, options?: UseChallenge500Options) {
  const qaMode = options?.qaMode ?? false
  const replayQuestionsRef = useRef(options?.replayQuestions)
  const [snapshot, setSnapshot] = useState<Challenge500Snapshot>(() => ({
    state: createChallenge500State(),
    currentSpec: null,
  }))
  const stateRef = useRef(createChallenge500State())
  const recentTypeRef = useRef<string | null>(null)
  const startedRef = useRef(false)
  const reached300Ref = useRef(false)
  const reached400Ref = useRef(false)
  const reached500Ref = useRef(false)
  const replayIndexRef = useRef(0)
  const recordedRef = useRef<ChallengeProblemSetItem[]>([])
  /**
   * Ver.6 Phase 5.3（Challenge勝敗判定強化）: Challenge用performance計測。
   * Challenge500QuestionResultはcorrectしか持たず（反応速度の概念を持ち込まない設計、
   * questions/challenge500/types.ts参照）、既存のstate（percent/floor）もMISSペナルティで
   * 変動するため「何問答えたか」をそこから逆算できない。そのため、ここで独立に
   * 正答数・総回答数・最大COMBO・反応速度（問題が表示された時刻からonResultまでの
   * 画面レベルの計測）を新規に記録する。既存のChallenge500State・画面の演出・
   * スコア遷移ロジックには一切影響しない、完全に並行した追加トラッキング。
   */
  const correctCountRef = useRef(0)
  const totalAnsweredRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const reactionMsListRef = useRef<number[]>([])
  const questionShownAtRef = useRef(0)

  function buildNext(): Challenge500QuestionSpec {
    const replayQuestions = replayQuestionsRef.current
    let spec: Challenge500QuestionSpec
    if (replayQuestions && replayIndexRef.current < replayQuestions.length) {
      spec = problemSetItemToSpec(replayQuestions[replayIndexRef.current])
      replayIndexRef.current += 1
    } else {
      spec = pickChallenge500Question(stateRef.current.percent, recentTypeRef.current)
    }
    recentTypeRef.current = spec.type
    if (recordedRef.current.length < MAX_RECORDED_PROBLEMS) {
      recordedRef.current = [...recordedRef.current, specToProblemSetItem(spec)]
    }
    // Ver.6 Phase 5.3: この問題が実際に表示された時刻を記録する（反応速度計測の基準点）。
    questionShownAtRef.current = performance.now()
    return spec
  }

  /** Ver.6 Phase 5.3（Challenge勝敗判定強化）: このプレイのChallenge用performance集計。 */
  function getPerformanceStats(): Challenge500PerformanceStats {
    return {
      totalAnswered: totalAnsweredRef.current,
      correctCount: correctCountRef.current,
      maxCombo: maxComboRef.current,
      reactionMsList: reactionMsListRef.current,
    }
  }

  /**
   * Ver.6 Phase 5.2: このプレイで実際に出題された問題列（Challenge作成に使う）。
   * replayQuestionsを使い切った後の問題も含め、実際に出た問題をそのまま記録している。
   */
  function getRecordedProblemSet(): ChallengeProblemSetItem[] {
    return recordedRef.current
  }

  function checkMilestones(state: Challenge500State) {
    if (qaMode) return
    if (!reached300Ref.current && state.floor >= 300) {
      reached300Ref.current = true
      trackReach300()
    }
    if (!reached400Ref.current && state.floor >= 400) {
      reached400Ref.current = true
      trackReach400()
    }
    if (!reached500Ref.current && state.cleared) {
      reached500Ref.current = true
      trackReach500()
    }
  }

  function start() {
    if (startedRef.current) return
    startedRef.current = true
    if (!qaMode) trackChallenge500Start()
    const spec = buildNext()
    setSnapshot({ state: stateRef.current, currentSpec: spec })
  }

  function handleResult(result: Challenge500QuestionResult) {
    // Ver.6 Phase 5.3: 既存のstate遷移（applyCorrect/applyMiss）より前に、Challenge用の
    // performance計測だけを独立して更新する（既存ロジックの入出力には一切影響しない）。
    const reactionMs = performance.now() - questionShownAtRef.current
    totalAnsweredRef.current += 1
    if (result.correct) {
      correctCountRef.current += 1
      comboRef.current += 1
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
      reactionMsListRef.current.push(reactionMs)
    } else {
      comboRef.current = 0
    }

    const next = result.correct ? applyCorrect(stateRef.current) : applyMiss(stateRef.current)
    stateRef.current = next
    checkMilestones(next)
    if (next.ended) {
      setSnapshot({ state: next, currentSpec: null })
      onFinish(next)
      return
    }
    const spec = buildNext()
    setSnapshot({ state: next, currentSpec: spec })
  }

  /**
   * QA/Preview専用: 実際の正解/MISSの連打を経由せず、指定％の状態へ直接移動する。
   * GA4のreach_300/400/500は（qaMode下のcheckMilestonesが常にno-opのため）絶対に
   * 送信されない。本番のapplyCorrect/applyMiss自体は一切呼ばないため、既存の
   * 状態遷移ロジックに影響しない。501%以上・500%ちょうどへのジャンプは要求されていない
   * ため扱わず、500%未満の値でのみ呼ばれる想定（呼び出し元のQAパネルのボタン構成で保証）。
   */
  function jumpTo(percent: number) {
    const next = createChallenge500StateAt(percent)
    stateRef.current = next
    if (next.ended) {
      setSnapshot({ state: next, currentSpec: null })
      return
    }
    const spec = buildNext()
    setSnapshot({ state: next, currentSpec: spec })
  }

  return { snapshot, start, handleResult, jumpTo, getRecordedProblemSet, getPerformanceStats }
}
