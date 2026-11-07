import { useRef, useState } from 'react'
import { applyCorrect, applyMiss, createChallenge500State, createChallenge500StateAt, type Challenge500State } from './challenge500Engine'
import { pickChallenge500Question } from '../questions/challenge500'
import { trackChallenge500Start, trackReach300, trackReach400, trackReach500 } from '../utils/analytics'
import type { Challenge500QuestionResult, Challenge500QuestionSpec } from '../questions/challenge500/types'

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
}

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の画面用エンジン。
 * 数値ロジック（challenge500Challenge.ts）・問題生成（questions/challenge500）・GA4の
 * 到達イベント送信（1プレイにつき1回だけ、既存のuseRushGame/useFinalTrialと
 * 同じ「ref一発ガード」方式）を1箇所にまとめる。
 */
export function useChallenge500(onFinish: (state: Challenge500State) => void, options?: UseChallenge500Options) {
  const qaMode = options?.qaMode ?? false
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

  function buildNext(): Challenge500QuestionSpec {
    const spec = pickChallenge500Question(stateRef.current.percent, recentTypeRef.current)
    recentTypeRef.current = spec.type
    return spec
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

  return { snapshot, start, handleResult, jumpTo }
}
