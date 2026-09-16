import { useEffect, useRef, useState } from 'react'
import { FINAL_TRIAL_CONFIG, tierForQuestionNumber } from '../config/finalTrialConfig'
import { pickFinalQuestion } from './finalQuestionPicker'
import type { FinalQuestionResult, FinalQuestionSpec, FinalQuestionTag } from '../types'

/**
 * Ver.5.0: FINAL DOPA TRIALのエンジン。120%到達後、全体の残り時間・+10秒延長などの
 * グローバルタイマーは一切存在しない（11. FINALでは全体時間を撤廃）。1問ごとの
 * targetTimeMsだけが各FinalQuestionModule.Componentの内部で管理される（通常のQuestionModuleと
 * 同じ設計：エンジン側はグローバルなfail-timerを一切持たない）。
 *
 * スコアはrawScore式を一切使わない。120%からスタートし、正解のたびに必ず+5%（整数演算のみ、
 * 浮動小数の影響を受けない）。MISS（誤答・timeout）が発生した瞬間、その時点のスコアのまま
 * 即座に終了する（減点はしない）。全16問（Q1〜Q15＋Q16のFINAL QUESTION）に正解すると200%。
 */

const SUCCESS_FLASH_MS = 320
/**
 * Ver.5.0（commit2時点の暫定値）：MISS/200%CLEARの瞬間、onFinish()を呼ぶまでの短い間。
 * 本格的な「TRIAL FAILED」演出・200%の超大型演出はcommit5で追加するが、それまでの間も
 * 結果画面へ即座に切り替わって唐突に見えないよう、ごく短い間だけ置く。
 */
const FAIL_TRANSITION_MS = 700
const CLEAR200_TRANSITION_MS = 700

export interface FinalTrialSnapshot {
  /** 現在挑戦中の問題番号（1〜16） */
  questionNumber: number
  percent: number
  currentSpec: FinalQuestionSpec | null
  phase: 'playing' | 'successFlash' | 'failed' | 'clear200'
  judgementKey: number
  /** 15問目突破時などの節目バナー文言 */
  milestoneLabel: string | null
}

export interface FinalTrialFinishPayload {
  finalPercent: number
  /** 成功したFINAL問題数（0〜16）。MISSで終了した場合はその時点までの成功数。 */
  trialsCleared: number
  cleared200: boolean
}

function milestoneLabelFor(clearedNumber: number): string {
  return `${clearedNumber} / ${FINAL_TRIAL_CONFIG.totalQuestions} CLEAR`
}

export function useFinalTrial(onFinish: (payload: FinalTrialFinishPayload) => void) {
  const [snapshot, setSnapshot] = useState<FinalTrialSnapshot>({
    questionNumber: 1,
    percent: FINAL_TRIAL_CONFIG.startPercent,
    currentSpec: null,
    phase: 'playing',
    judgementKey: 0,
    milestoneLabel: null,
  })

  const questionNumberRef = useRef(1)
  const percentRef = useRef(FINAL_TRIAL_CONFIG.startPercent)
  const endedRef = useRef(false)
  const startedRef = useRef(false)
  const currentSpecRef = useRef<FinalQuestionSpec | null>(null)
  const recentTypesRef = useRef<string[]>([])
  const recentTagsRef = useRef<FinalQuestionTag[]>([])
  const judgementKeyRef = useRef(0)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
    }
  }, [])

  /**
   * Q16（FINAL QUESTION＝箱シャッフル）は通常のtier抽選プールに属さない専用固定問題
   * （dedicated FinalQuestionBox component経由で処理される）。Q1〜Q15はtierForQuestionNumber()の
   * 階層プールからanti-clusteringで抽選する。
   */
  function buildQuestion(questionNumber: number): FinalQuestionSpec {
    const tier = tierForQuestionNumber(questionNumber) ?? 'mixed'
    const spec = pickFinalQuestion(tier, recentTypesRef.current, recentTagsRef.current)
    recentTypesRef.current = [spec.type, ...recentTypesRef.current].slice(0, 3)
    recentTagsRef.current = spec.tags
    currentSpecRef.current = spec
    return spec
  }

  /** FINAL突入演出が終わったタイミングで、呼び出し元（FinalTrialScreen）が1度だけ呼ぶ。 */
  function start() {
    if (startedRef.current || endedRef.current) return
    startedRef.current = true
    const spec = buildQuestion(1)
    setSnapshot((s) => ({ ...s, currentSpec: spec }))
  }

  function handleResult(result: FinalQuestionResult) {
    if (endedRef.current || currentSpecRef.current === null) return
    currentSpecRef.current = null

    if (!result.correct) {
      endedRef.current = true
      judgementKeyRef.current += 1
      const trialsCleared = questionNumberRef.current - 1
      setSnapshot((s) => ({ ...s, phase: 'failed', currentSpec: null, judgementKey: judgementKeyRef.current }))
      endTimerRef.current = setTimeout(() => {
        onFinish({ finalPercent: percentRef.current, trialsCleared, cleared200: false })
      }, FAIL_TRANSITION_MS)
      return
    }

    const clearedNumber = questionNumberRef.current
    percentRef.current += FINAL_TRIAL_CONFIG.percentPerCorrect
    judgementKeyRef.current += 1

    if (clearedNumber >= FINAL_TRIAL_CONFIG.totalQuestions) {
      endedRef.current = true
      setSnapshot((s) => ({
        ...s,
        phase: 'clear200',
        percent: FINAL_TRIAL_CONFIG.clearPercent,
        currentSpec: null,
        judgementKey: judgementKeyRef.current,
      }))
      endTimerRef.current = setTimeout(() => {
        onFinish({
          finalPercent: FINAL_TRIAL_CONFIG.clearPercent,
          trialsCleared: FINAL_TRIAL_CONFIG.totalQuestions,
          cleared200: true,
        })
      }, CLEAR200_TRANSITION_MS)
      return
    }

    questionNumberRef.current = clearedNumber + 1
    setSnapshot((s) => ({
      ...s,
      phase: 'successFlash',
      percent: percentRef.current,
      questionNumber: questionNumberRef.current,
      currentSpec: null,
      judgementKey: judgementKeyRef.current,
      milestoneLabel: milestoneLabelFor(clearedNumber),
    }))

    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => {
      if (endedRef.current) return
      const spec = buildQuestion(questionNumberRef.current)
      setSnapshot((s) => ({ ...s, phase: 'playing', currentSpec: spec, milestoneLabel: null }))
    }, SUCCESS_FLASH_MS)
  }

  return { snapshot, start, handleResult }
}
