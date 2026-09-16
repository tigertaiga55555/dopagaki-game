import { useEffect, useRef, useState } from 'react'
import { DIFFICULTY_PHASES, FINAL_RUSH_START_SEC, TOTAL_GAME_SEC, getPhaseAt } from '../config/difficultyConfig'
import { OVERDRIVE_CONFIG } from '../config/overdriveConfig'
import {
  MISS_PENALTY,
  SCORE_CONFIG,
  TIER_GAIN,
  comboGainMultiplier,
  comboLossPenalty,
  computeBonusGain,
  diminishingReturnsMultiplier,
  getDiminishingReturnsFloor,
  judgeByRatio,
  momentumGainMultiplier,
  nextMomentum,
} from '../config/scoreConfigV4'
import { TIMING_SAFETY } from '../config/timingConfig'
import { setCurrentStageIndex } from './difficultyStage'
import { generateNextQuestion } from './questionPicker'
import { randFloat } from './random'
import { QUESTION_MODULES } from '../questions'
import { duckAudio } from '../utils/audioContext'
import { playLateGameSweetener, playRiser, setBgmProgress, setOverdriveMode, startBgm, stopBgm } from '../utils/bgm'
import { sfx } from '../utils/sound'
import type { DifficultyPhaseId, Judgement, PlayStats, QuestionResult, QuestionSpec, QuestionTypeId } from '../types'

/** Ver.4.9: OVERDRIVE正式突入時に一度だけ加算する残り時間ボーナス（秒） */
const OVERDRIVE_TIME_BONUS_SEC = 10
/** Ver.4.9: DOPA BONUS TIMEを1ゲームにつき必ず1回、この秒数範囲のどこかで発生させる（毎回同じ秒数にはしない） */
const BONUS_TIME_WINDOW_START_SEC = 25
const BONUS_TIME_WINDOW_END_SEC = 40

const PRE_COUNTDOWN_MS = 1800
/** 100%/OVERDRIVE到達演出のときだけ、次の問題を意図的に少し遅らせる（それ以外は即座に次へ進む） */
const MILESTONE_FREEZE_MS = 650
/** PERFECT/GREAT/GOOD/MISSのオーバーレイ表示時間。次の問題の上に重ねるだけでゲーム進行は止めない。 */
const JUDGEMENT_OVERLAY_MS = 380
/** 100%到達時、BGM/SEを静める→バースト演出までの静寂の長さ */
const HUNDRED_SILENCE_MS = 300
/** Ver.4.7: 100%→101%突破時の「上限を破壊した」演出（数字の震え＋グリッチ＋LIMIT ERROR）の長さ */
const LIMIT_ERROR_MS = 550
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
/**
 * Ver.4.9: repeatTap/sequenceTap/shortVideoSwipeは「1問の完了までの合計時間」を返すため
 * 複数ステップぶんの時間が混ざり、releaseZoneは「ゾーン中心からのズレ量」であって
 * 反応時間そのものではない。結果画面の「最速反応」に、これらの値や非現実的な極小値
 * （例：0.05秒）が混入しないよう、いずれも反応速度の集計対象から除外する。
 */
const NON_SPEED_TYPES = new Set<QuestionTypeId>([
  'holdPress',
  'noPress',
  'stopAt100',
  'bonusTime',
  'repeatTap',
  'sequenceTap',
  'shortVideoSwipe',
  'releaseZone',
])

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

/**
 * Ver.5.0: onEnterFinalは、rawScoreがゲーム開始から完全ノーミスで120%へ到達した瞬間に
 * 一度だけ呼ばれる（そこまでのPlayStatsを引き継ぐ）。この時点でエンジン自体は完全に停止し
 * （endedRef=true、以後のtick/出題は一切行わない）、以後はFINAL DOPA TRIAL側
 * （useFinalTrial）が別エンジンとしてゲームを引き継ぐ。onFinishは非FINALな終了
 * （時間切れ、MISS経験ありでの101〜119%終了など）でのみ呼ばれる。
 */
export function useRushGame(onFinish: (payload: RushFinishPayload) => void, onEnterFinal: (stats: PlayStats) => void) {
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
  const overdriveActiveRef = useRef(false)
  /** Ver.5.0: rawScoreが120（OVERDRIVE_CONFIG.maxPercent）へゲーム開始から完全ノーミスで到達した瞬間だけtrueになる。FINAL DOPA TRIAL突入は1ゲーム1回のみ。 */
  const finalEntryTriggeredRef = useRef(false)
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
  /** Ver.4.9: DOPA MOMENTUM（直近の質の高さを表す0〜1のメーター）。MISSで即0にリセットされる。 */
  const momentumRef = useRef(0)
  /** Ver.4.9: ゲーム開始から一度でもMISSしたか。120%到達の必須条件（一度でもMISSしたら119%が上限）。 */
  const hasEverMissedRef = useRef(false)
  /** Ver.4.9: OVERDRIVE正式突入時に一度だけ加算される残り時間ボーナス（秒）。1ゲーム1回のみ。 */
  const overdriveBonusSecRef = useRef(0)
  /** Ver.4.9: DOPA BONUS TIMEを1ゲーム必ず1回、この秒（経過秒）で強制出題する。開始時に一度だけ抽選。 */
  const bonusTimeScheduledAtSecRef = useRef(randFloat(BONUS_TIME_WINDOW_START_SEC, BONUS_TIME_WINDOW_END_SEC))
  const bonusTimeUsedRef = useRef(false)

  /** Ver.4.9: OVERDRIVE到達時+10秒ぶん、ゲーム全体の実効プレイ時間を延長する。 */
  function totalGameSec(): number {
    return TOTAL_GAME_SEC + overdriveBonusSecRef.current
  }

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

  function currentRawScore(): number {
    return rawScoreRef.current
  }

  function setPercentTarget() {
    const rawScore = currentRawScore()
    // Ver.4.9追加修正: OVERDRIVEの隠しeligibility条件は突入条件として廃止した。
    // rawScoreがゲーム中で初めて100へ到達した瞬間、無条件でOVERDRIVEへ突入する
    // （「100%到達したのにOVERDRIVEへ入れない」実機不具合の直接の原因除去）。
    // overdriveActiveRef.currentは一度trueになったら二度とfalseへ戻らないため、
    // ここでのフラグ確定と+10秒ボーナス付与は構造的に1ゲーム1回だけになる
    // （100→MISS→98→100と再到達しても、2回目はenteringOverdriveNowがfalseになる）。
    const enteringOverdriveNow = !overdriveActiveRef.current && rawScore >= 100
    if (enteringOverdriveNow) {
      overdriveActiveRef.current = true
      overdriveBonusSecRef.current = OVERDRIVE_TIME_BONUS_SEC
    }
    // 非OVERDRIVEは常に100が上限、OVERDRIVE突入後は119（一度でもMISSしている場合）
    // または120（ゲーム開始から完全ノーミスの場合のみ）。
    const cap = overdriveActiveRef.current ? (hasEverMissedRef.current ? 119 : OVERDRIVE_CONFIG.maxPercent) : 100
    const target = Math.max(0, Math.min(cap, rawScore))

    const crossingHundred = enteringOverdriveNow
    // Ver.5.0: 120%（=OVERDRIVE_CONFIG.maxPercent）に初めて到達した瞬間、もはや
    // 「完全攻略CLEAR」ではなくFINAL DOPA TRIALへの入口になった。一度でもMISSしていると
    // capが119止まりになるため、ここに到達できるのはゲーム開始から完全ノーミスのプレイだけ
    // （2. 120%到達条件も維持）。
    const crossingFinalEntry = !finalEntryTriggeredRef.current && target >= OVERDRIVE_CONFIG.maxPercent
    if (crossingFinalEntry) {
      finalEntryTriggeredRef.current = true
      // 「120%へ到達した瞬間、ゲーム一時停止」：エンジン自体をここで即座に停止する
      // （以後のtick・出題を一切行わない）。演出・FINAL DOPA TRIALへの引き継ぎは
      // 呼び出し元（PlayScreen）がonEnterFinalを受けて行う。
      endedRef.current = true
      // tickループがこのタイミングで完全に止まるため、通常のイージングtween（420ms）を
      // 最後まで再生する機会がない。表示が119%台のまま固まらないよう、120%へ即座にスナップする。
      displayPercentRef.current = target
      setSnapshot((s) => ({ ...s, displayPercent: target }))
      // Ver.5.0: このパスはfinishGame()を経由しないため、そちらが担うstopBgm()がここでも
      // 必要。呼ばないとOVERDRIVE BGMがFINAL DOPA TRIAL突入後もループし続け、FinalTrialScreen
      // 側が新たに始めるFINAL専用BGMと二重に鳴ってしまう（11. FINALでは全体タイマーだけでなく
      // 通常/OVERDRIVE BGMも完全に切り替わるべき）。
      stopBgm()
    }

    percentTweenRef.current = { from: displayPercentRef.current, to: target, startedAt: performance.now() }

    // 「100%という上限を破壊した」演出（数字の震え→グリッチ→LIMIT ERROR→DOPA OVERDRIVE）。
    // 状態変化（overdriveActiveRef/overdriveBonusSecRef/capの引き上げ）は上で既に同期的に
    // 確定済みで、ここはあくまで視覚・音の演出タイミングだけを担う。
    function runOverdriveBreach() {
      setSnapshot((s) => ({ ...s, showLimitErrorGlitch: true }))
      setTimeout(() => {
        sfx.overdrive()
        setOverdriveMode(true)
        setSnapshot((s) => ({ ...s, showLimitErrorGlitch: false, showOverdriveBurst: true, overdriveActive: true }))
        setTimeout(() => {
          setSnapshot((s) => ({ ...s, showOverdriveBurst: false }))
          if (crossingFinalEntry) onEnterFinal(statsRef.current)
        }, MILESTONE_FREEZE_MS)
      }, LIMIT_ERROR_MS)
    }

    if (crossingHundred) {
      // 演出のクライマックス：騒がしいBGM/SEを一瞬静める→静寂の後にバースト音と演出を同時に出す
      duckAudio(HUNDRED_SILENCE_MS, 1)
      setTimeout(() => {
        sfx.hundred()
        setSnapshot((s) => ({ ...s, showHundredBurst: true }))
        setTimeout(() => {
          setSnapshot((s) => ({ ...s, showHundredBurst: false }))
          // 新仕様では100%到達＝即OVERDRIVE突入のため、runOverdriveBreach()は
          // crossingHundredの直後に必ず続けて呼ぶ（別条件として分岐させない）。
          runOverdriveBreach()
        }, MILESTONE_FREEZE_MS)
      }, HUNDRED_SILENCE_MS)
    } else if (crossingFinalEntry) {
      onEnterFinal(statsRef.current)
    }
    return { crossingHundred, crossingFinalEntry }
  }

  function buildNextQuestionSpec(): QuestionSpec | null {
    if (endedRef.current || startTimeRef.current === null) return null
    const elapsedSec = (performance.now() - startTimeRef.current) / 1000
    if (elapsedSec >= totalGameSec()) return null
    const phase = getPhaseAt(elapsedSec)
    let spec: QuestionSpec
    // Ver.4.9: DOPA BONUS TIMEは抽選プールに含めず、1ゲームにつき必ず1回、開始時に決めた
    // 経過秒（25〜40秒のどこか）に達した瞬間、強制的にこの1問として出題する。
    // OVERDRIVEの+10秒延長中は既に使用済みのため二重発生しない（bonusTimeUsedRefで保証）。
    if (!bonusTimeUsedRef.current && elapsedSec >= bonusTimeScheduledAtSecRef.current) {
      bonusTimeUsedRef.current = true
      const module = QUESTION_MODULES.bonusTime
      const data = module.generate()
      const scaledBase = module.baseTargetTimeMs * phase.speedMultiplier
      const minRequired = Math.max(TIMING_SAFETY.absoluteFloorMs, module.computeMinTargetTimeMs?.(data) ?? 0)
      const targetTimeMs = Math.round(Math.max(scaledBase, minRequired))
      spec = { instanceId: `bonus-${Math.round(elapsedSec)}`, type: 'bonusTime', targetTimeMs, data }
    } else {
      spec = generateNextQuestion(phase, recentTypesRef.current)
    }
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
      // Ver.4.10: 基本ペナルティに「切れた瞬間のCOMBOの大きさ」ぶんを上乗せする。
      // 育てたCOMBOが大きいほどMISSの実質ペナルティが重くなる（切る前のcomboRef値を使う）。
      const basePenalty = missPenaltyForReason(inferFailureReason(spec, result))
      const penalty = basePenalty + comboLossPenalty(comboRef.current)
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
      // MOMENTUMも即座に0へリセットする（COMBOとは別軸だが、MISSでは両方とも消える）。
      momentumRef.current = 0
      // ゲーム開始から一度でもMISSしたら、以後ずっとtrue（120%到達の必須条件に使う）。
      hasEverMissedRef.current = true
      // MISSは理由カテゴリ別のペナルティ＋COMBO_LOSSで実際に減点する（フロアは0）。
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
        // 「1タップ=1%」のような直接変換はせず、通常問題1〜2問ぶん相当を上限とする
        // firmly cappedなボーナス（COMBO・MOMENTUM倍率は適用しない＝連打の速さそのものだけで評価する）。
        rawScoreRef.current += computeBonusGain(result.meta?.bonusTapCount ?? 0)
      } else {
        const qualityTier = tier as 'PERFECT' | 'GREAT' | 'GOOD'
        // DOPA MOMENTUM。今回の加点にはこの正解「より前」の蓄積分（直近の質の高さ）を
        // 適用し、加点が確定してからこの正解ぶんをMOMENTUMへ積む（終盤の連続PERFECTが
        // 「98→99→100」のような逆転を後押しできるようにする）。
        // Ver.4.10: DIMINISHING_RETURNSも同様に「加点前のrawScore」を基準に適用する
        // （正答率ではなくプレイヤー自身のその時点のrawScoreだけで決まる値ベースの逓減）。
        // Ver.4.11: OVERDRIVE突入後（overdriveActiveRef.current）だけfloorを緩和する。
        // 0〜99%の間はgetDiminishingReturnsFloor()がundefinedを返し、従来通りの
        // DIM_FLOOR_NORMALにフォールバックするため、100%到達までの難易度は無変更。
        const dimFloor = getDiminishingReturnsFloor(overdriveActiveRef.current, hasEverMissedRef.current)
        const gain =
          TIER_GAIN[qualityTier] *
          comboGainMultiplier(comboRef.current) *
          momentumGainMultiplier(momentumRef.current) *
          diminishingReturnsMultiplier(rawScoreRef.current, dimFloor)
        rawScoreRef.current += gain
        momentumRef.current = nextMomentum(momentumRef.current, qualityTier)
      }
    }

    const { crossingHundred, crossingFinalEntry } = setPercentTarget()
    judgementKeyRef.current += 1
    const judgementKey = judgementKeyRef.current

    if (crossingHundred || crossingFinalEntry) {
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
      if (crossingFinalEntry) {
        // Ver.5.0: 120%到達＝FINAL DOPA TRIAL突入。onEnterFinal()がこの後の演出・
        // エンジン引き継ぎをすべて担うため、ここでは次の問題を一切出さない
        // （setPercentTarget()内で既にendedRef=trueに設定済み）。
        return
      }
      let freezeMs = 0
      // 新仕様では100%到達＝即OVERDRIVE突入が常に同時に起きるため、両方の演出時間を
      // 合算してcrossingHundredの1本にまとめる（crossingOverdriveは独立の分岐として存在しない）。
      if (crossingHundred) freezeMs += HUNDRED_SILENCE_MS + MILESTONE_FREEZE_MS + LIMIT_ERROR_MS + MILESTONE_FREEZE_MS
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
    const rawPercent = currentRawScore()
    // setPercentTarget()と同じcapロジック。overdriveActiveRefは「rawScoreが一度でも
    // 100へ到達したか」の単一の真実源であり、eligibility概念には依存しない。
    const cap = overdriveActiveRef.current ? (hasEverMissedRef.current ? 119 : OVERDRIVE_CONFIG.maxPercent) : 100
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
      const effectiveTotalSec = totalGameSec()
      if (elapsedSec >= effectiveTotalSec) {
        finishGame()
        return
      }

      const phase = getPhaseAt(elapsedSec)
      const remainingSec = effectiveTotalSec - elapsedSec
      const finalRushActive = elapsedSec >= FINAL_RUSH_START_SEC
      // Ver.4.9: OVERDRIVE+10秒延長ぶん、終了3秒前カウントダウンの発火位置も動的に後ろへずれる。
      const countdownValue = elapsedSec >= effectiveTotalSec - 3 ? Math.max(1, Math.ceil(effectiveTotalSec - elapsedSec)) : null

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
