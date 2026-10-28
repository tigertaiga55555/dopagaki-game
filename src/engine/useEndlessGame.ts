import { useRef, useState } from 'react'
import { endlessMilestoneLevel, getEndlessPhase, isEndlessMilestone } from '../config/endlessConfig'
import { applyEndlessCorrect, applyEndlessMiss, createEndlessState, type EndlessState } from './endlessEngine'
import { generateNextQuestion } from './questionPicker'
import { trackEndlessEnd, trackEndlessStart } from '../utils/analytics'
import { getEndlessBest, updateEndlessBest } from '../utils/storage'
import { sfx } from '../utils/sound'
import type { EndlessDifficulty, QuestionResult, QuestionSpec, QuestionTypeId } from '../types'

/** 直近何問分のタイプを覚えておくか。useRushGame.tsと同じ値・同じ目的（カテゴリ連続回避）。 */
const RECENT_TYPES_LENGTH = 3
/** 節目バナー（例: "10 STREAK"）の表示時間（ms）。useRushGameのcomboMilestoneLabelと同じ値。 */
const MILESTONE_BANNER_MS = 900

export interface EndlessSnapshot {
  state: EndlessState
  currentSpec: QuestionSpec | null
  /** 節目（10/20/30/50...）到達時だけ短時間表示するバナー文言。テンポを止めない非ブロッキング表示。 */
  milestoneLabel: string | null
  milestoneKey: number
}

export interface EndlessFinishPayload {
  score: number
  isNewBest: boolean
  best: number
}

export interface UseEndlessGameOptions {
  /**
   * Preview/QA専用モード。trueの場合、GA4のendless_start/endless_end送信と
   * localStorageの自己ベスト更新を両方抑制する（既存のuseChallenge500.tsと同じ方針：
   * QA操作を実際のプレイ記録として残さない）。
   */
  qaMode?: boolean
}

/**
 * Ver.6 Phase 4: Endlessモード（「何問連続正解できるか」）の画面用エンジン。
 *
 * 通常ゲーム（useRushGame.ts）のDOPA%・COMBO倍率・MOMENTUM・OVERDRIVE等は一切持たない
 * ——Endlessはスコア＝連続正解数だけのシンプルなモードのため、それらは不要かつ過剰。
 * その代わり、問題生成（questionPicker.generateNextQuestion）・問題コンポーネント自体
 * （QUESTION_MODULES、呼び出し元の画面がspec.typeから解決する）は通常ゲームと完全に
 * 共有し、二重管理しない。
 *
 * BGM（startBgm/stopBgm/setBgmProgress）はこのhookではなく呼び出し元の画面
 * （EndlessPlayScreen.tsx）が担当する——useChallenge500.tsと同じ責務分担（hook＝
 * ゲームロジック、画面＝音・演出の副作用）を踏襲した。
 */
export function useEndlessGame(
  difficulty: EndlessDifficulty,
  onFinish: (payload: EndlessFinishPayload) => void,
  options?: UseEndlessGameOptions,
) {
  const qaMode = options?.qaMode ?? false
  const phase = getEndlessPhase(difficulty)

  const [snapshot, setSnapshot] = useState<EndlessSnapshot>(() => ({
    state: createEndlessState(),
    currentSpec: null,
    milestoneLabel: null,
    milestoneKey: 0,
  }))

  const stateRef = useRef(createEndlessState())
  const recentTypesRef = useRef<QuestionTypeId[]>([])
  const startedRef = useRef(false)
  const milestoneKeyRef = useRef(0)
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function buildNext(): QuestionSpec {
    const spec = generateNextQuestion(phase, recentTypesRef.current)
    recentTypesRef.current = [spec.type, ...recentTypesRef.current].slice(0, RECENT_TYPES_LENGTH)
    return spec
  }

  function start() {
    if (startedRef.current) return
    startedRef.current = true
    if (!qaMode) trackEndlessStart(difficulty)
    const spec = buildNext()
    setSnapshot({ state: stateRef.current, currentSpec: spec, milestoneLabel: null, milestoneKey: 0 })
  }

  function handleResult(result: QuestionResult) {
    if (stateRef.current.ended) return

    if (result.correct) {
      sfx.comboUp()
      const next = applyEndlessCorrect(stateRef.current)
      stateRef.current = next

      if (isEndlessMilestone(next.streak)) {
        sfx.comboMilestone(endlessMilestoneLevel(next.streak))
        milestoneKeyRef.current += 1
        const milestoneKey = milestoneKeyRef.current
        const label = `${next.streak} STREAK`
        if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
        milestoneTimerRef.current = setTimeout(() => {
          setSnapshot((s) => (s.milestoneKey === milestoneKey ? { ...s, milestoneLabel: null } : s))
        }, MILESTONE_BANNER_MS)
        const nextSpec = buildNext()
        setSnapshot((s) => ({ ...s, state: next, currentSpec: nextSpec, milestoneLabel: label, milestoneKey }))
        return
      }

      const nextSpec = buildNext()
      setSnapshot((s) => ({ ...s, state: next, currentSpec: nextSpec }))
      return
    }

    // MISS（時間切れも各問題コンポーネント自身がcorrect:falseを返すだけで、ここでは
    // 区別しない——endlessEngine.applyEndlessMiss参照）。即終了し、結果を一度だけ通知する。
    sfx.miss()
    const next = applyEndlessMiss(stateRef.current)
    stateRef.current = next
    if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
    const isNewBest = !qaMode && updateEndlessBest(difficulty, next.streak)
    if (!qaMode) trackEndlessEnd(difficulty, next.streak, isNewBest)
    setSnapshot((s) => ({ ...s, state: next, currentSpec: null, milestoneLabel: null }))
    onFinish({ score: next.streak, isNewBest, best: getEndlessBest(difficulty) })
  }

  return { snapshot, start, handleResult }
}
