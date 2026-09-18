import { useEffect, useRef, useState } from 'react'
import { FINAL_TRIAL_CONFIG, tierForQuestionNumber } from '../config/finalTrialConfig'
import { pickFinalQuestion } from './finalQuestionPicker'
import { ULTIMATE_QUESTION_POOL } from '../questions/final'
import { pick } from './random'
import { trackPerfectClear, trackUltimateReached } from '../utils/analytics'
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

/**
 * Ver.5.0(16.): 通常の成功演出は「テンポを崩さない」ため0.2〜0.4秒程度に収める。
 * 節目（Q4/Q8/Q12/Q15）だけは特別に長く見せてよい（17. 強度エスカレーション）。
 */
const SUCCESS_FLASH_MS_NORMAL = 340
const SUCCESS_FLASH_MS_MILESTONE = 900
const MILESTONE_NUMBERS = new Set([4, 8, 12, 15])
function successFlashDurationFor(clearedNumber: number): number {
  return MILESTONE_NUMBERS.has(clearedNumber) ? SUCCESS_FLASH_MS_MILESTONE : SUCCESS_FLASH_MS_NORMAL
}
/**
 * Ver.5.0追加修正: 15問目クリア後だけ入る「ULTIMATE QUESTION」緊急警告演出の表示時間。
 * FinalTrialScreen側でdarken（暗転・静寂）→warning（赤フラッシュ＋WARNING）→
 * banner（ULTIMATE QUESTION＋煽り文）の3ビートに内部分割して使う。
 */
const ULTIMATE_INTRO_MS = 2400
const FAIL_TRANSITION_MS = 1400
/**
 * Ver.5.0追加(TASK C-10): 200%だけは結果画面へ急いで移動せず、宝箱開封からPERFECT CLEARの
 * 余韻まで含めて約5〜7秒程度の特大クライマックスにしてよい（達成感優先）。
 * FinalTrialScreen側の演出強化（花火の複数打ち上げ・強化ファンファーレ）に合わせて延長した。
 */
const CLEAR200_TRANSITION_MS = 6200

export type FinalTrialPhase = 'playing' | 'successFlash' | 'ultimateIntro' | 'failed' | 'clear200'

export interface FinalTrialSnapshot {
  /** 現在挑戦中の問題番号（1〜16） */
  questionNumber: number
  percent: number
  currentSpec: FinalQuestionSpec | null
  phase: FinalTrialPhase
  judgementKey: number
  /** 直前に突破した問題番号（1〜16）。成功演出の強度計算に使う。突破直後以外はnull。 */
  lastClearedNumber: number | null
  /** 15問目突破時などの節目バナー文言 */
  milestoneLabel: string | null
}

export interface FinalTrialFinishPayload {
  finalPercent: number
  /** 成功したFINAL問題数（0〜16）。MISSで終了した場合はその時点までの成功数。 */
  trialsCleared: number
  cleared200: boolean
}

/**
 * Ver.5.0: 成功演出の強度（1〜5）。Q1-3=1、Q4/Q5-7=2、Q8/Q9-11=3、Q12/Q13-14=4、Q15=5、
 * という形でQ1→Q15に向けて確実にエスカレートしていく（17. 成功演出の強度エスカレーション）。
 */
export function finalSuccessIntensityFor(clearedNumber: number): 1 | 2 | 3 | 4 | 5 {
  if (clearedNumber <= 3) return 1
  if (clearedNumber <= 7) return 2
  if (clearedNumber <= 11) return 3
  if (clearedNumber <= 14) return 4
  return 5
}

function milestoneLabelFor(clearedNumber: number): string {
  if (clearedNumber === 4) return '4 / 16 突破！'
  if (clearedNumber === 8) return '折り返し突破！ 8 / 16'
  if (clearedNumber === 12) return '12 / 16 突破！'
  if (clearedNumber === 15) return '195% 到達！'
  return `${clearedNumber} / ${FINAL_TRIAL_CONFIG.totalQuestions} CLEAR`
}

export function useFinalTrial(onFinish: (payload: FinalTrialFinishPayload) => void, initialQuestionNumber = 1) {
  const [snapshot, setSnapshot] = useState<FinalTrialSnapshot>({
    questionNumber: initialQuestionNumber,
    percent: FINAL_TRIAL_CONFIG.startPercent + (initialQuestionNumber - 1) * FINAL_TRIAL_CONFIG.percentPerCorrect,
    currentSpec: null,
    phase: 'playing',
    judgementKey: 0,
    lastClearedNumber: null,
    milestoneLabel: null,
  })

  const questionNumberRef = useRef(initialQuestionNumber)
  const percentRef = useRef(FINAL_TRIAL_CONFIG.startPercent + (initialQuestionNumber - 1) * FINAL_TRIAL_CONFIG.percentPerCorrect)
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
   * Q16（ULTIMATE QUESTION）は通常のtier抽選プールに属さない専用抽選プール
   * （ULTIMATE_QUESTION_POOL、ランダムプールからは絶対に抽選されない）から、毎回1種類を
   * ランダムに抽選する。全16問中1回きりの一発抽選のため、Q1〜Q15のような反復履歴を
   * 前提としたanti-clusteringは不要（単純なpick()で十分）。Q1〜Q15はtierForQuestionNumber()
   * の階層プールからanti-clusteringで抽選する。
   */
  function buildQuestion(questionNumber: number): FinalQuestionSpec {
    if (questionNumber === FINAL_TRIAL_CONFIG.totalQuestions) {
      const module = pick(ULTIMATE_QUESTION_POOL)
      const data = module.generate()
      const targetTimeMs = module.computeTargetTimeMs(data)
      const spec: FinalQuestionSpec = {
        instanceId: `final-ultimate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: module.id,
        tags: module.tags,
        targetTimeMs,
        data,
      }
      recentTypesRef.current = [spec.type, ...recentTypesRef.current].slice(0, 3)
      recentTagsRef.current = spec.tags
      currentSpecRef.current = spec
      return spec
    }

    const tier = tierForQuestionNumber(questionNumber) ?? 'mixed'
    const spec = pickFinalQuestion(tier, recentTypesRef.current, recentTagsRef.current)
    recentTypesRef.current = [spec.type, ...recentTypesRef.current].slice(0, 3)
    recentTagsRef.current = spec.tags
    currentSpecRef.current = spec
    return spec
  }

  /**
   * Ver.5.0追加修正: clearedNumber突破直後の演出遷移（successFlash→[ULTIMATE緊急警告]→次の問題）
   * を1箇所にまとめた共通処理。handleResult()の通常成功パスと、Preview
   * （?preview=finalquestion/clear200のstartAtQuestion=16直接開始）の両方から同じ関数を呼ぶことで、
   * Previewでも「195%/15-16 CLEAR→ULTIMATE QUESTION緊急警告→実際の問題」という本物の遷移を
   * そのまま再生できるようにする（52. フェイク版は一切作らない）。
   */
  function triggerPostClearFlow(clearedNumber: number) {
    setSnapshot((s) => ({
      ...s,
      phase: 'successFlash',
      percent: percentRef.current,
      questionNumber: questionNumberRef.current,
      currentSpec: null,
      judgementKey: judgementKeyRef.current,
      lastClearedNumber: clearedNumber,
      milestoneLabel: milestoneLabelFor(clearedNumber),
    }))

    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => {
      if (endedRef.current) return
      // Ver.5.0追加修正: 15問目を突破した直後だけ、Q16（ULTIMATE QUESTION）へ即座には入らず、
      // 「緊急警告演出」（darken→warning→banner）を一度挟む。
      if (clearedNumber === FINAL_TRIAL_CONFIG.totalQuestions - 1) {
        setSnapshot((s) => ({ ...s, phase: 'ultimateIntro', milestoneLabel: null }))
        successTimerRef.current = setTimeout(() => {
          if (endedRef.current) return
          const spec = buildQuestion(questionNumberRef.current)
          trackUltimateReached()
          setSnapshot((s) => ({ ...s, phase: 'playing', currentSpec: spec }))
        }, ULTIMATE_INTRO_MS)
        return
      }
      const spec = buildQuestion(questionNumberRef.current)
      setSnapshot((s) => ({ ...s, phase: 'playing', currentSpec: spec, milestoneLabel: null }))
    }, successFlashDurationFor(clearedNumber))
  }

  /**
   * FINAL突入演出が終わったタイミングで、呼び出し元（FinalTrialScreen）が1度だけ呼ぶ。
   * Ver.5.0追加修正: initialQuestionNumber===16（Preview専用の直接開始）の場合だけは、
   * いきなりQ16を出題せず、15問目クリア時と全く同じtriggerPostClearFlow(15)を再生する
   * （195%/15-16 CLEAR→ULTIMATE QUESTION緊急警告→実際の問題、という本物の遷移）。
   */
  function start() {
    if (startedRef.current || endedRef.current) return
    startedRef.current = true
    if (questionNumberRef.current === FINAL_TRIAL_CONFIG.totalQuestions) {
      triggerPostClearFlow(FINAL_TRIAL_CONFIG.totalQuestions - 1)
      return
    }
    const spec = buildQuestion(questionNumberRef.current)
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
      trackPerfectClear()
      setSnapshot((s) => ({
        ...s,
        phase: 'clear200',
        percent: FINAL_TRIAL_CONFIG.clearPercent,
        currentSpec: null,
        judgementKey: judgementKeyRef.current,
        lastClearedNumber: clearedNumber,
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
    triggerPostClearFlow(clearedNumber)
  }

  return { snapshot, start, handleResult }
}
