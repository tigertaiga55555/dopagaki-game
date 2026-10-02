import { useRef, useState } from 'react'
import { applyCorrect, applyMiss, createEndlessState, type EndlessState } from './endlessChallenge'
import { pickEndlessQuestion } from '../questions/endless'
import { trackChallenge500Start, trackReach300, trackReach400, trackReach500 } from '../utils/analytics'
import type { EndlessQuestionResult, EndlessQuestionSpec } from '../questions/endless/types'

export interface EndlessChallengeSnapshot {
  state: EndlessState
  currentSpec: EndlessQuestionSpec | null
}

/**
 * Ver.6 Phase 1: 200〜500%「限界突破チャレンジ」の画面用エンジン。
 * 数値ロジック（endlessChallenge.ts）・問題生成（questions/endless）・GA4の
 * 到達イベント送信（1プレイにつき1回だけ、既存のuseRushGame/useFinalTrialと
 * 同じ「ref一発ガード」方式）を1箇所にまとめる。
 */
export function useEndlessChallenge(onFinish: (state: EndlessState) => void) {
  const [snapshot, setSnapshot] = useState<EndlessChallengeSnapshot>(() => ({
    state: createEndlessState(),
    currentSpec: null,
  }))
  const stateRef = useRef(createEndlessState())
  const recentTypeRef = useRef<string | null>(null)
  const startedRef = useRef(false)
  const reached300Ref = useRef(false)
  const reached400Ref = useRef(false)
  const reached500Ref = useRef(false)

  function buildNext(): EndlessQuestionSpec {
    const spec = pickEndlessQuestion(stateRef.current.percent, recentTypeRef.current)
    recentTypeRef.current = spec.type
    return spec
  }

  function checkMilestones(state: EndlessState) {
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
    trackChallenge500Start()
    const spec = buildNext()
    setSnapshot({ state: stateRef.current, currentSpec: spec })
  }

  function handleResult(result: EndlessQuestionResult) {
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

  return { snapshot, start, handleResult }
}
