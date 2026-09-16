import { useEffect, useRef, useState } from 'react'
import { COUNTDOWN_START_SEC, DIFFICULTY_PHASES, FINAL_RUSH_START_SEC, TOTAL_GAME_SEC, getPhaseAt } from '../config/difficultyConfig'
import { OVERDRIVE_CONFIG, evaluateOverdriveEligibility } from '../config/overdriveConfig'
import {
  MISS_PENALTY,
  SCORE_CONFIG,
  TIER_GAIN,
  comboGainMultiplier,
  computeBonusGain,
  getAccuracyCap,
  judgeByRatio,
} from '../config/scoreConfigV4'
import { setCurrentStageIndex } from './difficultyStage'
import { generateNextQuestion } from './questionPicker'
import { duckAudio } from '../utils/audioContext'
import { playLateGameSweetener, playRiser, setBgmProgress, setOverdriveMode, startBgm, stopBgm } from '../utils/bgm'
import { sfx } from '../utils/sound'
import type { DifficultyPhaseId, Judgement, PlayStats, QuestionResult, QuestionSpec, QuestionTypeId } from '../types'

const PRE_COUNTDOWN_MS = 1800
/** 100%/OVERDRIVE到達演出のときだけ、次の問題を意図的に少し遅らせる（それ以外は即座に次へ進む） */
const MILESTONE_FREEZE_MS = 650
/** PERFECT/GREAT/GOOD/MISSのオーバーレイ表示時間。次の問題の上に重ねるだけでゲーム進行は止めない。 */
const JUDGEMENT_OVERLAY_MS = 380
/** 100%到達時、BGM/SEを静める→バースト演出までの静寂の長さ */
const HUNDRED_SILENCE_MS = 300
/** Ver.4.7: 100%→101%突破時の「上限を破壊した」演出（数字の震え＋グリッチ＋LIMIT ERROR）の長さ */
const LIMIT_ERROR_MS = 550
/** Ver.4.7: 120%（上限）到達時、一瞬音を引く長さ */
const MAX_SILENCE_MS = 250
/** Ver.4.7: 120%到達演出の表示保持時間（最大クライマックスなので少し長めに） */
const MAX_BURST_HOLD_MS = 900
/** 大きいCOMBOを切った瞬間の「怯み」演出（画面暗転・BGMダック）の長さ */
const COMBO_BREAK_FLINCH_MS = 200
/** COMBO BREAK演出の文言を強めに出す最低COMBO数 */
const BIG_COMBO_BREAK_THRESHOLD = 10
/** 連続正解の節目。値ごとの演出レベルは comboVisualBonus / comboMilestoneLevel で決める */
const COMBO_MILESTONES: number[] = [5, 10, 15, 20, 25]
/** FINAL DOPA RUSH突入前にライザーSEを鳴らすタイミング（残り秒） */
const RISER_LEAD_SEC = 2

/**
 * 反応速度をベースにした比率算出から除外する問題タイプ（「速さ」の概念が当てはまらないため）。
 * repeatTap/rapidStopはratioWindowMsで公平な反応比率を計算できるためここには含めない。
 * Ver.4.5: releaseZoneも「タイミングの正確さ」でratioWindowMsを使うため除外はしない。
 */
const NON_SPEED_TYPES = new Set<QuestionTypeId>(['holdPress', 'noPress', 'stopAt100', 'bonusTime'])

/** Ver.4.5: 残り20秒からBGMに薄いライザーを足すタイミング（残り秒） */
const LATE_GAME_SWEETENER_SEC = 20

/** 直近何問分のタイプを覚えておくか（questionPickerのカテゴリ連続回避・直近タイプ回避に使う） */
const RECENT_TYPES_LENGTH = 3

/**
 * Ver.4.6: 開発時だけMISSの原因を追跡できるようにするデバッグログ。本番UIには一切表示しない
 * （console.debugのみ、かつ開発ビルドでのみ出力）。「本当にユーザー操作が間違っていたのか、
 * タイムアウトなのか」を切り分けられるよう、meta由来の明確な理由を優先し、それ以外は
 * reactionMsがtargetTimeMsにどれだけ近いかで汎用タイムアウトらしさを推定する。
 */
function inferFailureReason(spec: QuestionSpec, result: QuestionResult): string {
  const meta = result.meta
  if (meta?.redPhaseTap) return 'red-phase-tap'
  if (meta?.forbiddenTouch) return 'forbidden-touch'
  if (meta?.earlyPress) return 'early-press'
  if (meta?.wrongOrder) return 'wrong-order'
  if (meta?.releaseOffsetMs !== undefined) return meta.releaseOffsetMs > 0 ? 'release-too-late' : 'release-too-early'
  if (meta?.extraTaps) return 'extra-taps'
  if (result.reactionMs >= spec.targetTimeMs * 0.95) return 'likely-generic-timeout'
  return 'explicit-wrong-action'
}

function logQuestionMiss(spec: QuestionSpec, result: QuestionResult, penalty: number): void {
  if (!import.meta.env.DEV) return
  console.debug('[dopagaki:miss]', {
    questionType: spec.type,
    questionInstanceId: spec.instanceId,
    result: 'MISS',
    failureReason: inferFailureReason(spec, result),
    penalty,
    elapsedMs: Math.round(result.reactionMs),
    targetTimeMs: spec.targetTimeMs,
    ratioWindowMs: result.ratioWindowMs ?? spec.targetTimeMs,
    meta: result.meta,
  })
}

/**
 * Ver.4.8: MISSの理由カテゴリを、実際に減算するペナルティ量にマッピングする。
 * - impulsive（衝動そのものの失敗）：押すな中に押した／規定回数を超えて押したなど＝最も重い
 * - wrong（明確な誤操作・誤答）：中程度
 * - timeout（単純な反応漏れ・時間切れ）：最も軽い
 */
function missPenaltyForReason(reason: string): number {
  switch (reason) {
    case 'forbidden-touch':
    case 'early-press':
    case 'extra-taps':
    case 'red-phase-tap':
      return MISS_PENALTY.impulsive
    case 'wrong-order':
    case 'release-too-late':
    case 'release-too-early':
    case 'explicit-wrong-action':
      return MISS_PENALTY.wrong
    case 'likely-generic-timeout':
    default:
      return MISS_PENALTY.timeout
  }
}

function comboVisualBonus(combo: number): number {
  if (combo >= 20) return 3
  if (combo >= 15) return 2
  if (combo >= 10) return 1
  if (combo >= 5) return 1
  return 0
}

function comboMilestoneLevel(combo: number): 1 | 2 | 3 | 4 | 5 {
  if (combo >= 25) return 5
  if (combo >= 20) return 4
  if (combo >= 15) return 3
  if (combo >= 10) return 2
  return 1
}

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
  /** comboBrokenFromが大きいときだけtrue。画面暗転など強めのCOMBO BREAK演出に使う */
  comboBreakBig: boolean
  showHundredBurst: boolean
  showOverdriveBurst: boolean
  /** Ver.4.7: 100%→101%突破の瞬間、数字の震え＋グリッチ＋LIMIT ERRORを表示する */
  showLimitErrorGlitch: boolean
  /** Ver.4.7: 120%（上限）到達時の最大クライマックス演出 */
  showMaxBurst: boolean
  overdriveActive: boolean
  /** 連続正解の節目（10/20など）で短時間だけ表示するバナー文言 */
  comboMilestoneLabel: string | null
  comboMilestoneKey: number
  /** Ver.4.8: GO！の瞬間だけ一瞬光らせる、開始演出用のフラッシュ */
  showGoFlash: boolean
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
}

const SAMPLE_LOG_CAP = 10

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
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
    comboBreakBig: false,
    showHundredBurst: false,
    showOverdriveBurst: false,
    showLimitErrorGlitch: false,
    showMaxBurst: false,
    overdriveActive: false,
    comboMilestoneLabel: null,
    comboMilestoneKey: 0,
    showGoFlash: false,
  })

  const preStartRef = useRef(performance.now())
  const startTimeRef = useRef<number | null>(null)
  const endedRef = useRef(false)

  // Ver.4.8: 0から始まる加算/減算式の累積スコア。正解のたびにTier×COMBO倍率ぶん加点し、
  // MISSのたびに理由別ペナルティで減点する（フロアは0）。表示上限は正答率のcapを
  // その都度被せるだけで、rawScore自体は上限を超えて溜まっていてもよい。
  const rawScoreRef = useRef(0)
  const percentTweenRef = useRef({ from: 0, to: 0, startedAt: 0 })
  const displayPercentRef = useRef(0)

  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  /** 直近に出題したタイプ（先頭が最新）。questionPickerのカテゴリ連続回避に使う。 */
  const recentTypesRef = useRef<QuestionTypeId[]>([])
  const currentSpecRef = useRef<QuestionSpec | null>(null)
  const statsRef = useRef<PlayStats>(createStats())
  const tapTimestampsRef = useRef<number[]>([])
  const gapActiveRef = useRef(true)
  const hundredReachedRef = useRef(false)
  const overdriveActiveRef = useRef(false)
  const maxReachedRef = useRef(false)
  const judgementKeyRef = useRef(0)
  const alarmedSecondsRef = useRef(new Set<number>())
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const comboMilestoneKeyRef = useRef(0)
  const comboMilestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const riserFiredRef = useRef(false)
  const bgmStartedRef = useRef(false)
  const lateGameSweetenerFiredRef = useRef(false)
  const warningBeep5sFiredRef = useRef(false)
  const lastCountdownValueRef = useRef<number | null>(null)
  /** Ver.4.8: 開始前3・2・1カウントダウンで、同じ値に対して音を二重再生しないためのガード */
  const preCountdownAudioRef = useRef<number | null>(null)

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

  function currentAccuracy(): number {
    const s = statsRef.current
    return s.totalAnswered > 0 ? s.correctCount / s.totalAnswered : 0
  }

  function currentEligibility() {
    const s = statsRef.current
    const avgRatio =
      s.reactionSamples.length > 0
        ? s.reactionSamples.reduce((sum, r) => sum + r.reactionMs / r.targetTimeMs, 0) / s.reactionSamples.length
        : 1
    return evaluateOverdriveEligibility({
      accuracy: currentAccuracy(),
      avgReactionRatio: avgRatio,
      maxCombo: maxComboRef.current,
      hastyTapCount: s.hastyTapCount,
      noPressFails: s.noPressFails,
    })
  }

  function currentRawScore(): number {
    return rawScoreRef.current
  }

  function setPercentTarget() {
    const eligible = currentEligibility().eligible
    const rawScore = currentRawScore()
    const cap = eligible ? OVERDRIVE_CONFIG.maxPercent : getAccuracyCap(currentAccuracy())
    const target = Math.max(0, Math.min(cap, rawScore))

    const wasHundred = hundredReachedRef.current
    const crossingHundred = !wasHundred && target >= 100
    const crossingOverdrive = eligible && !overdriveActiveRef.current && target > 100
    // Ver.4.7: 120%（既存の隠し上限=OVERDRIVE_CONFIG.maxPercent）に初めて到達した瞬間だけの
    // 追加クライマックス演出。上限の値・発動条件自体は一切変更していない（観測して演出するだけ）。
    const crossingMax = eligible && !maxReachedRef.current && target >= OVERDRIVE_CONFIG.maxPercent
    if (crossingMax) maxReachedRef.current = true

    percentTweenRef.current = { from: displayPercentRef.current, to: target, startedAt: performance.now() }

    // Ver.4.7: 「100%という上限を破壊した」演出（数字の震え→グリッチ→LIMIT ERROR→DOPA OVERDRIVE）。
    function runOverdriveBreach() {
      setSnapshot((s) => ({ ...s, showLimitErrorGlitch: true }))
      setTimeout(() => {
        overdriveActiveRef.current = true
        sfx.overdrive()
        setOverdriveMode(true)
        setSnapshot((s) => ({ ...s, showLimitErrorGlitch: false, showOverdriveBurst: true, overdriveActive: true }))
        setTimeout(() => {
          setSnapshot((s) => ({ ...s, showOverdriveBurst: false }))
          if (crossingMax) runMaxClimax()
        }, MILESTONE_FREEZE_MS)
      }, LIMIT_ERROR_MS)
    }

    // Ver.4.7: 120%到達の最大クライマックス（一瞬音を引く→黄金爆発）。
    function runMaxClimax() {
      duckAudio(MAX_SILENCE_MS, 1)
      setTimeout(() => {
        sfx.overdriveMax()
        setSnapshot((s) => ({ ...s, showMaxBurst: true }))
        setTimeout(() => setSnapshot((s) => ({ ...s, showMaxBurst: false })), MAX_BURST_HOLD_MS)
      }, MAX_SILENCE_MS)
    }

    if (crossingHundred) {
      hundredReachedRef.current = true
      // 演出のクライマックス：騒がしいBGM/SEを一瞬静める→静寂の後にバースト音と演出を同時に出す
      duckAudio(HUNDRED_SILENCE_MS, 1)
      setTimeout(() => {
        sfx.hundred()
        setSnapshot((s) => ({ ...s, showHundredBurst: true }))
        setTimeout(() => {
          setSnapshot((s) => ({ ...s, showHundredBurst: false }))
          if (crossingOverdrive) runOverdriveBreach()
          else if (crossingMax) runMaxClimax()
        }, MILESTONE_FREEZE_MS)
      }, HUNDRED_SILENCE_MS)
    } else if (crossingOverdrive) {
      runOverdriveBreach()
    } else if (crossingMax) {
      runMaxClimax()
    }
    return { crossingHundred, crossingOverdrive, crossingMax }
  }

  function buildNextQuestionSpec(): QuestionSpec | null {
    if (endedRef.current || startTimeRef.current === null) return null
    const elapsedSec = (performance.now() - startTimeRef.current) / 1000
    if (elapsedSec >= TOTAL_GAME_SEC) return null
    const phase = getPhaseAt(elapsedSec)
    const spec = generateNextQuestion(phase, recentTypesRef.current)
    recentTypesRef.current = [spec.type, ...recentTypesRef.current].slice(0, RECENT_TYPES_LENGTH)
    currentSpecRef.current = spec
    return spec
  }

  function handleQuestionResult(result: QuestionResult) {
    const spec = currentSpecRef.current
    if (!spec || endedRef.current) return
    currentSpecRef.current = null

    const ratioWindowMs = result.ratioWindowMs ?? spec.targetTimeMs
    const tier: Judgement = result.tierOverride ?? (result.correct ? judgeByRatio(result.reactionMs, ratioWindowMs) : 'MISS')
    const stats = statsRef.current
    stats.totalAnswered += 1
    if (spec.type === 'noPress') stats.noPressTotal += 1
    if (result.meta?.earlyPress) stats.earlyPressCount += 1
    if (result.meta?.extraTaps) stats.overPressCount += result.meta.extraTaps
    if (result.meta?.stoppedAtValue !== undefined) {
      const stoppedAtValue = result.meta.stoppedAtValue
      stats.stopAt100Samples.push({ stopped: stoppedAtValue, diff: Math.abs(stoppedAtValue - 100) })
      if (stats.stopAt100Samples.length > SAMPLE_LOG_CAP) stats.stopAt100Samples.shift()
    }
    if (tier !== 'MISS' && result.meta?.targetsCleared !== undefined) {
      if (spec.type === 'notifRush') {
        stats.notifRushSamples.push({ count: result.meta.targetsCleared, ms: result.reactionMs })
        if (stats.notifRushSamples.length > SAMPLE_LOG_CAP) stats.notifRushSamples.shift()
      } else {
        stats.notificationClearSamples.push({ count: result.meta.targetsCleared, ms: result.reactionMs })
        if (stats.notificationClearSamples.length > SAMPLE_LOG_CAP) stats.notificationClearSamples.shift()
      }
    }
    if (result.meta?.redPhaseTap) stats.rapidStopRedTaps += 1
    if (result.meta?.fooledByWord) stats.colorWordFooledCount += 1
    if (result.meta?.releaseOffsetMs !== undefined && result.meta.releaseOffsetMs > 0) {
      stats.releaseZoneOverMs.push(result.meta.releaseOffsetMs)
      if (stats.releaseZoneOverMs.length > SAMPLE_LOG_CAP) stats.releaseZoneOverMs.shift()
    }
    if (tier !== 'MISS' && spec.type === 'sequenceTap') {
      stats.sequenceTapSamples.push({ ms: result.reactionMs })
      if (stats.sequenceTapSamples.length > SAMPLE_LOG_CAP) stats.sequenceTapSamples.shift()
    }
    if (tier !== 'MISS' && spec.type === 'findTarget') {
      const icon = (spec.data as { target?: string }).target ?? '🔥'
      stats.findTargetSamples.push({ icon, ms: result.reactionMs })
      if (stats.findTargetSamples.length > SAMPLE_LOG_CAP) stats.findTargetSamples.shift()
    }
    if (tier !== 'MISS' && spec.type === 'shortVideoSwipe') {
      stats.shortVideoSamples.push({ ms: result.reactionMs })
      if (stats.shortVideoSamples.length > SAMPLE_LOG_CAP) stats.shortVideoSamples.shift()
    }

    const typeEntry = stats.typeStats[spec.type] ?? { correct: 0, total: 0 }
    typeEntry.total += 1
    if (tier !== 'MISS') typeEntry.correct += 1
    stats.typeStats[spec.type] = typeEntry

    const isBonusTime = spec.type === 'bonusTime'

    let comboBrokenFrom = 0
    let comboBreakBig = false
    if (tier === 'MISS') {
      const penalty = missPenaltyForReason(inferFailureReason(spec, result))
      logQuestionMiss(spec, result, penalty)
      stats.missCount += 1
      if (spec.type === 'noPress' && result.meta?.forbiddenTouch) stats.noPressFails += 1
      if (spec.type === 'noPress' && comboRef.current >= 8) {
        stats.comboLostToNoPress = Math.max(stats.comboLostToNoPress, comboRef.current)
      }
      if (comboRef.current >= 2) comboBrokenFrom = comboRef.current
      if (comboRef.current >= BIG_COMBO_BREAK_THRESHOLD) {
        comboBreakBig = true
        duckAudio(COMBO_BREAK_FLINCH_MS, 0.6)
        sfx.comboBreak()
      } else {
        sfx.miss()
      }
      comboRef.current = 0
      // Ver.4.8: MISSは理由カテゴリ別のペナルティで実際に減点する（フロアは0＝一撃で0まで落ちない）。
      // COMBOも同時に切れるため、大きいCOMBO中のMISSほど「二重の痛さ」になる。
      rawScoreRef.current = Math.max(0, rawScoreRef.current - penalty)
    } else {
      stats.correctCount += 1
      if (!NON_SPEED_TYPES.has(spec.type)) {
        stats.reactionSamples.push({ type: spec.type, reactionMs: result.reactionMs, targetTimeMs: ratioWindowMs, correct: true })
        if (stats.fastestReactionMs === null || result.reactionMs < stats.fastestReactionMs) {
          stats.fastestReactionMs = result.reactionMs
        }
      }
      comboRef.current += 1
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
      stats.maxCombo = maxComboRef.current
      if (comboRef.current > 1) sfx.comboUp()
      if (tier === 'PERFECT' && spec.type === 'stopAt100') {
        sfx.stopAt100(true)
      } else if (!isBonusTime) {
        // Ver.4.5: 連続正解が伸びるほど判定音の音程が少しずつ上がる
        // （DOPA BONUS TIME自身がタップごとの専用音を鳴らすため、ここでは重複させない）
        sfx.comboPitchedTier(tier, comboRef.current)
      }

      if (COMBO_MILESTONES.includes(comboRef.current)) {
        sfx.comboMilestone(comboMilestoneLevel(comboRef.current))
        if (comboRef.current === 10 || comboRef.current === 20) {
          comboMilestoneKeyRef.current += 1
          const milestoneKey = comboMilestoneKeyRef.current
          const label = `${comboRef.current}問連続正解！`
          if (comboMilestoneTimerRef.current) clearTimeout(comboMilestoneTimerRef.current)
          setSnapshot((s) => ({ ...s, comboMilestoneLabel: label, comboMilestoneKey: milestoneKey }))
          comboMilestoneTimerRef.current = setTimeout(() => {
            setSnapshot((s) => (s.comboMilestoneKey === milestoneKey ? { ...s, comboMilestoneLabel: null } : s))
          }, 900)
        }
      }

      if (isBonusTime) {
        // Ver.4.8: 「1タップ=1%」のような直接変換はせず、通常問題1〜2問ぶん相当を上限とする
        // firmly cappedなボーナス（COMBO倍率は適用しない＝連打の速さそのものだけで評価する）。
        rawScoreRef.current += computeBonusGain(result.meta?.bonusTapCount ?? 0)
      } else {
        const gain = TIER_GAIN[tier as 'PERFECT' | 'GREAT' | 'GOOD'] * comboGainMultiplier(comboRef.current)
        rawScoreRef.current += gain
      }
    }

    const { crossingHundred, crossingOverdrive, crossingMax } = setPercentTarget()
    judgementKeyRef.current += 1
    const judgementKey = judgementKeyRef.current

    if (crossingHundred || crossingOverdrive || crossingMax) {
      // 節目の演出のときだけ、意図的に少し間を置いてから次の問題を出す
      // （どの節目を跨いだかに応じて、それぞれの演出時間ぶんだけ加算する）
      gapActiveRef.current = true
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
      setSnapshot((s) => ({
        ...s,
        currentSpec: null,
        combo: comboRef.current,
        lastJudgement: tier,
        judgementKey,
        comboBrokenFrom,
        comboBreakBig,
      }))
      let freezeMs = 0
      if (crossingHundred) freezeMs += HUNDRED_SILENCE_MS + MILESTONE_FREEZE_MS
      if (crossingOverdrive) freezeMs += LIMIT_ERROR_MS + MILESTONE_FREEZE_MS
      if (crossingMax) freezeMs += MAX_SILENCE_MS + MAX_BURST_HOLD_MS
      nextQuestionTimerRef.current = setTimeout(() => {
        const spec2 = buildNextQuestionSpec()
        gapActiveRef.current = false
        setSnapshot((s) => ({ ...s, currentSpec: spec2 }))
      }, freezeMs)
      return
    }

    // 通常時：次の問題をすぐ出し、判定表示はその上に短時間だけ重ねる（ゲームのテンポを止めない）
    const nextSpec = buildNextQuestionSpec()
    setSnapshot((s) => ({
      ...s,
      currentSpec: nextSpec,
      combo: comboRef.current,
      lastJudgement: tier,
      judgementKey,
      comboBrokenFrom,
      comboBreakBig,
    }))

    if (overlayHideTimerRef.current) clearTimeout(overlayHideTimerRef.current)
    overlayHideTimerRef.current = setTimeout(() => {
      setSnapshot((s) => (s.judgementKey === judgementKey ? { ...s, lastJudgement: null, comboBreakBig: false } : s))
    }, JUDGEMENT_OVERLAY_MS)
  }

  function finishGame() {
    if (endedRef.current) return
    endedRef.current = true
    currentSpecRef.current = null
    if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
    if (overlayHideTimerRef.current) clearTimeout(overlayHideTimerRef.current)
    if (comboMilestoneTimerRef.current) clearTimeout(comboMilestoneTimerRef.current)
    stopBgm()
    const eligibility = currentEligibility()
    const rawPercent = currentRawScore()
    const cap = eligibility.eligible ? OVERDRIVE_CONFIG.maxPercent : getAccuracyCap(currentAccuracy())
    const finalPercent = Math.max(0, Math.round(Math.min(cap, rawPercent)))
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
        // Ver.4.8: START→3・2・1・GOの開始演出。3→2→1と音程が少しずつ上がるビープを鳴らし、
        // GOの瞬間にBGM開始・画面フラッシュ・最初の問題出現を同期させる。
        if (value !== null && value !== preCountdownAudioRef.current) {
          preCountdownAudioRef.current = value
          sfx.countdownBeep(value)
        }
        if (remaining <= 0) {
          startTimeRef.current = now
          gapActiveRef.current = false
          if (!bgmStartedRef.current) {
            bgmStartedRef.current = true
            sfx.gameStart()
            startBgm()
          }
          const spec = buildNextQuestionSpec()
          setSnapshot((s) => ({ ...s, currentSpec: spec, showGoFlash: true }))
          setTimeout(() => setSnapshot((s) => ({ ...s, showGoFlash: false })), 260)
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
          // Ver.4.5: 残り5秒台で警告ビープを一度追加し、通常のサイレンより緊迫感を強める
          if (bucket % 2 === 0 || bucket <= 5) sfx.finalRushAlarm()
        }
        if (!warningBeep5sFiredRef.current && remainingSec <= 5) {
          warningBeep5sFiredRef.current = true
          sfx.finalWarningBeep()
        }
      }
      if (countdownValue !== null && countdownValue !== lastCountdownValueRef.current && countdownValue <= 3) {
        lastCountdownValueRef.current = countdownValue
        sfx.countdownBeep(countdownValue)
      }
      // Ver.4.5: 残り20秒付近から薄いライザーを一度だけ足し、終盤への予感を演出する
      if (!lateGameSweetenerFiredRef.current && remainingSec <= LATE_GAME_SWEETENER_SEC) {
        lateGameSweetenerFiredRef.current = true
        playLateGameSweetener()
      }
      if (!riserFiredRef.current && remainingSec <= TOTAL_GAME_SEC - FINAL_RUSH_START_SEC + RISER_LEAD_SEC) {
        riserFiredRef.current = true
        playRiser()
      }

      const stageIndex = DIFFICULTY_PHASES.findIndex((p) => p.id === phase.id)
      setCurrentStageIndex(stageIndex < 0 ? 0 : stageIndex)
      setBgmProgress(stageIndex < 0 ? 0 : stageIndex, comboRef.current)

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
        visualLevel: phase.visualLevel + (visualBasis >= 95 ? 1 : 0) + comboVisualBonus(comboRef.current),
        finalRushActive,
        countdownValue,
      }))

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current)
      if (overlayHideTimerRef.current) clearTimeout(overlayHideTimerRef.current)
      if (comboMilestoneTimerRef.current) clearTimeout(comboMilestoneTimerRef.current)
      stopBgm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { snapshot, handleQuestionResult }
}
