import { useEffect, useRef, useState } from 'react'
import { COUNTDOWN_START_SEC, FINAL_RUSH_START_SEC, TOTAL_GAME_SEC, getPhaseAt } from '../config/difficultyConfig'
import { OVERDRIVE_CONFIG, evaluateOverdriveEligibility } from '../config/overdriveConfig'
import { SCORE_CONFIG, judgeByRatio } from '../config/scoreConfigV4'
import { generateNextQuestion } from './questionPicker'
import { sfx } from '../utils/sound'
import type { DifficultyPhaseId, Judgement, PlayStats, QuestionResult, QuestionSpec, QuestionTypeId } from '../types'

const PRE_COUNTDOWN_MS = 1800
const GAP_MS = 190

export interface RushSnapshot {
  phaseId: DifficultyPhaseId
  remainingSec: number
  currentSpec: QuestionSpec | null
  displayPercent: number
  combo: number
  visualLevel: number
  finalRushActive: boolean
  countdownValue: number | null
  preCountdown: number | null
  lastJudgement: Judgement | null
  judgementKey: number
  /** MISSでCOMBOが切れた場合、切れる直前のCOMBO数（2以上のときだけCOMBO BREAK表示に使う） */
  comboBrokenFrom: number
  showHundredBurst: boolean
  showOverdriveBurst: boolean
  overdriveActive: boolean
}

export interface RushFinishPayload {
  rawPercent: number
  finalPercent: number
  overdriveActive: boolean
  stats: PlayStats
}

function createStats(): PlayStats {
  return {
    totalAnswered: 0,
    correctCount: 0,
    missCount: 0,
    maxCombo: 0,
    reactionSamples: [],
    fastestReactionMs: null,
    noPressTotal: 0,
    noPressFails: 0,
    hastyTapCount: 0,
    maxTapsInOneSecond: 0,
    comboLostToNoPress: 0,
    typeStats: {},
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function rawScoreToPercent(rawScore: number): number {
  return (rawScore / SCORE_CONFIG.targetRawScoreFor100) * 100
}

export function useRushGame(onFinish: (payload: RushFinishPayload) => void) {
  const [snapshot, setSnapshot] = useState<RushSnapshot>({
    phaseId: 'warmup',
    remainingSec: TOTAL_GAME_SEC,
    currentSpec: null,
    displayPercent: 0,
    combo: 0,
    visualLevel: 0,
    finalRushActive: false,
    countdownValue: null,
    preCountdown: 3,
    lastJudgement: null,
    judgementKey: 0,
    comboBrokenFrom: 0,
    showHundredBurst: false,
    showOverdriveBurst: false,
    overdriveActive: false,
  })

  const preStartRef = useRef(performance.now())
  const startTimeRef = useRef<number | null>(null)
  const endedRef = useRef(false)

  const rawScoreRef = useRef(0)
  const percentTweenRef = useRef({ from: 0, to: 0, startedAt: 0 })
  const displayPercentRef = useRef(0)

  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const lastTypeRef = useRef<QuestionTypeId | null>(null)
  const currentSpecRef = useRef<QuestionSpec | null>(null)
  const statsRef = useRef<PlayStats>(createStats())
  const tapTimestampsRef = useRef<number[]>([])
  const gapActiveRef = useRef(true)
  const hundredReachedRef = useRef(false)
  const overdriveActiveRef = useRef(false)
  const judgementKeyRef = useRef(0)
  const alarmedSecondsRef = useRef(new Set<number>())
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // グローバルなタップ監視：先走り操作・1秒間の最大タップ数を記録する
  useEffect(() => {
    function handlePointerDown() {
      const now = performance.now()
      tapTimestampsRef.current.push(now)
      tapTimestampsRef.current = tapTimestampsRef.current.filter((t) => now - t <= 1000)
      statsRef.current.maxTapsInOneSecond = Math.max(statsRef.current.maxTapsInOneSecond, tapTimestampsRef.current.length)
      if (gapActiveRef.current) {
        statsRef.current.hastyTapCount += 1
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function currentEligibility() {
    const s = statsRef.current
    const avgRatio =
      s.reactionSamples.length > 0
        ? s.reactionSamples.reduce((sum, r) => sum + r.reactionMs / r.targetTimeMs, 0) / s.reactionSamples.length
        : 1
    return evaluateOverdriveEligibility({
      accuracy: s.totalAnswered > 0 ? s.correctCount / s.totalAnswered : 0,
      avgReactionRatio: avgRatio,
      maxCombo: maxComboRef.current,
      hastyTapCount: s.hastyTapCount,
      noPressFails: s.noPressFails,
    })
  }

  function setPercentTarget(nextRaw: number) {
    rawScoreRef.current = nextRaw
    const eligible = currentEligibility().eligible
    const cap = eligible ? OVERDRIVE_CONFIG.maxPercent : 100
    const target = Math.max(0, Math.min(cap, rawScoreToPercent(nextRaw)))

    const wasHundred = hundredReachedRef.current
    const crossingHundred = !wasHundred && target >= 100
    const crossingOverdrive = eligible && !overdriveActiveRef.current && target > 100

    percentTweenRef.current = { from: displayPercentRef.current, to: target, startedAt: performance.now() }

    if (crossingHundred) {
      hundredReachedRef.current = true
      sfx.hundred()
      setSnapshot((s) => ({ ...s, showHundredBurst: true }))
      setTimeout(() => setSnapshot((s) => ({ ...s, showHundredBurst: false })), 650)
    }
    if (crossingOverdrive) {
      overdriveActiveRef.current = true
      sfx.overdrive()
      setSnapshot((s) => ({ ...s, showOverdriveBurst: true, overdriveActive: true }))
      setTimeout(() => setSnapshot((s) => ({ ...s, showOverdriveBurst: false })), 650)
    }
    return { crossingHundred, crossingOverdrive }
  }

  function spawnNextQuestion() {
    if (endedRef.current || startTimeRef.current === null) return
    const elapsedSec = (performance.now() - startTimeRef.current) / 1000
    if (elapsedSec >= TOTAL_GAME_SEC) return
    const phase = getPhaseAt(elapsedSec)
    const spec = generateNextQuestion(phase, lastTypeRef.current)
    lastTypeRef.current = spec.type
    currentSpecRef.current = spec
    gapActiveRef.current = false
    setSnapshot((s) => ({ ...s, currentSpec: spec }))
  }

  function handleQuestionResult(result: QuestionResult) {
    const spec = currentSpecRef.current
    if (!spec || endedRef.current) return
    currentSpecRef.current = null
    gapActiveRef.current = true

    const tier: Judgement = result.tierOverride ?? (result.correct ? judgeByRatio(result.reactionMs, spec.targetTimeMs) : 'MISS')
    const stats = statsRef.current
    stats.totalAnswered += 1
    if (spec.type === 'noPress') stats.noPressTotal += 1

    const typeEntry = stats.typeStats[spec.type] ?? { correct: 0, total: 0 }
    typeEntry.total += 1
    if (tier !== 'MISS') typeEntry.correct += 1
    stats.typeStats[spec.type] = typeEntry

    let comboBrokenFrom = 0
    if (tier === 'MISS') {
      stats.missCount += 1
      if (spec.type === 'noPress' && result.meta?.forbiddenTouch) stats.noPressFails += 1
      if (spec.type === 'noPress' && comboRef.current >= 8) {
        stats.comboLostToNoPress = Math.max(stats.comboLostToNoPress, comboRef.current)
      }
      if (comboRef.current >= 2) comboBrokenFrom = comboRef.current
      comboRef.current = 0
      sfx.miss()
    } else {
      stats.correctCount += 1
      stats.reactionSamples.push({ type: spec.type, reactionMs: result.reactionMs, targetTimeMs: spec.targetTimeMs, correct: true })
      if (spec.type !== 'holdPress' && spec.type !== 'noPress') {
        if (stats.fastestReactionMs === null || result.reactionMs < stats.fastestReactionMs) {
          stats.fastestReactionMs = result.reactionMs
        }
      }
      comboRef.current += 1
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
      stats.maxCombo = maxComboRef.current
      if (comboRef.current > 1) sfx.comboUp()
      if (tier === 'PERFECT') sfx.perfect()
      else if (tier === 'GREAT') sfx.great()
      else sfx.good()
    }

    const comboBonus = tier === 'MISS' ? 0 : Math.min(comboRef.current, SCORE_CONFIG.comboBonusCapCount) * SCORE_CONFIG.comboBonusPoints
    const basePoints = SCORE_CONFIG.basePoints * SCORE_CONFIG.tierMultiplier[tier]
    const delta = tier === 'MISS' ? -SCORE_CONFIG.missPenalty : basePoints + comboBonus
    const nextRaw = Math.max(0, rawScoreRef.current + delta)

    const { crossingHundred } = setPercentTarget(nextRaw)
    judgementKeyRef.current += 1

    setSnapshot((s) => ({
      ...s,
      currentSpec: null,
      combo: comboRef.current,
      lastJudgement: tier,
      judgementKey: judgementKeyRef.current,
      comboBrokenFrom,
    }))

    const gapMs = crossingHundred ? 650 : GAP_MS
    if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
    nextQuestionTimerRef.current = setTimeout(spawnNextQuestion, gapMs)
  }

  function finishGame() {
    if (endedRef.current) return
    endedRef.current = true
    currentSpecRef.current = null
    if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
    const eligibility = currentEligibility()
    const rawPercent = rawScoreToPercent(rawScoreRef.current)
    const finalPercent = Math.max(0, Math.round(Math.min(eligibility.eligible ? OVERDRIVE_CONFIG.maxPercent : 100, rawPercent)))
    onFinish({
      rawPercent,
      finalPercent,
      overdriveActive: overdriveActiveRef.current,
      stats: statsRef.current,
    })
  }

  useEffect(() => {
    let raf: number

    function tick() {
      const now = performance.now()

      if (startTimeRef.current === null) {
        const elapsed = now - preStartRef.current
        const remaining = Math.max(0, PRE_COUNTDOWN_MS - elapsed)
        const value = remaining <= 0 ? null : remaining > 1200 ? 3 : remaining > 600 ? 2 : 1
        setSnapshot((s) => (s.preCountdown === value ? s : { ...s, preCountdown: value }))
        if (remaining <= 0) {
          startTimeRef.current = now
          gapActiveRef.current = false
          spawnNextQuestion()
        }
        raf = requestAnimationFrame(tick)
        return
      }

      if (endedRef.current) return

      const elapsedSec = (now - startTimeRef.current) / 1000
      if (elapsedSec >= TOTAL_GAME_SEC) {
        finishGame()
        return
      }

      const phase = getPhaseAt(elapsedSec)
      const remainingSec = TOTAL_GAME_SEC - elapsedSec
      const finalRushActive = elapsedSec >= FINAL_RUSH_START_SEC
      const countdownValue = elapsedSec >= COUNTDOWN_START_SEC ? Math.max(1, Math.ceil(TOTAL_GAME_SEC - elapsedSec)) : null

      if (finalRushActive) {
        const bucket = Math.floor(remainingSec)
        if (bucket <= 10 && !alarmedSecondsRef.current.has(bucket)) {
          alarmedSecondsRef.current.add(bucket)
          if (bucket % 2 === 0 || bucket <= 3) sfx.finalRushAlarm()
        }
      }

      const tween = percentTweenRef.current
      const tweenElapsed = now - tween.startedAt
      const ratio = tween.to === tween.from ? 1 : Math.min(1, tweenElapsed / SCORE_CONFIG.percentTweenMs)
      displayPercentRef.current = tween.from + (tween.to - tween.from) * easeOutCubic(ratio)
      const visualBasis = Math.min(100, displayPercentRef.current)

      setSnapshot((s) => ({
        ...s,
        phaseId: phase.id,
        remainingSec,
        displayPercent: Math.round(displayPercentRef.current * 10) / 10,
        combo: comboRef.current,
        visualLevel: phase.visualLevel + (visualBasis >= 95 ? 1 : 0),
        finalRushActive,
        countdownValue,
      }))

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { snapshot, handleQuestionResult }
}
