import { useEffect, useRef, useState } from 'react'
import {
  Clear200ImpactOverlay,
  Clear200SlamOverlay,
  Fireworks200Overlay,
  FinalEntryTextOverlay,
  FinalFailOverlay,
  FinalSuccessBurst,
  FinalWorldAmbience,
  HudCrackOverlay,
  UltimateIntroOverlay,
  UltimateWorldAmbience,
  WorldShatterOverlay,
} from '../components/FinalFx'
import { Confetti120Overlay, GoldenClearOverlay, RainbowShockwaveOverlay, Sparkle120Overlay, WhiteFlashOverlay } from '../components/OverdriveFx'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { computeFinalTrialResult } from '../engine/resultEngineV4'
import { finalSuccessIntensityFor, useFinalTrial } from '../engine/useFinalTrial'
import { FINAL_QUESTION_MODULES, ULTIMATE_QUESTION_POOL } from '../questions/final'
import { duckAudio, unlockAudio } from '../utils/audioContext'
import { setFinalIntensity, setFinalMode, setUltimateMode, startBgm, stopBgm } from '../utils/bgm'
import { isMuted, PERFECT_FANFARE_200_TIMING_MS, setMuted, sfx } from '../utils/sound'
import type { FinalResultV4, PlayStats } from '../types'

interface Props {
  initialStats: PlayStats
  onFinish: (result: FinalResultV4) => void
  /** Ver.5.0: 通常は1（Q1から開始）。Previewの?preview=finalquestion/clear200だけ16を渡し、
   *  ULTIMATE QUESTIONから直接プレビューできるようにする。 */
  startAtQuestion?: number
  /**
   * Ver.5.0: Preview専用の便利機能フラグ。trueのとき、画面右下に「⏩ 強制正解」ボタンを出し、
   * 押すと現在の問題を（実際の判定関数=handleResultをそのまま使って）正解扱いで即座に
   * 突破できる。ロジックは本番と完全に同じ関数を呼ぶだけで、偽の演出は一切作らない
   * （52. Previewは実際のproductionコンポーネント／ロジックを直接再利用する）。
   * 本番（App.tsxの通常プレイ経路）からは絶対に渡されない。
   */
  showForceCorrect?: boolean
  /**
   * Ver.5.0: Preview専用（?preview=clear200）。設定した場合、最初にプレイ可能になった問題
   * （＝startAtQuestion=16のULTIMATE QUESTION）に対して、この遅延後に自動でforceCorrect相当の
   * 正解処理を1回だけ行う。中身は showForceCorrect のボタンが呼ぶのと全く同じ本番の
   * handleResult()呼び出しであり、実際にゲームをプレイしなくても200% CLEAR演出を
   * すぐ確認できるようにするための便宜機能。本番からは絶対に渡されない。
   */
  autoForceCorrectDelayMs?: number
}

/**
 * Ver.5.0: FINAL DOPA TRIAL専用画面。120%到達後、通常ゲーム（PlayScreen）から完全に
 * 引き継がれる。通常ゲームのグローバル残り時間・OVERDRIVE延長タイマーは一切存在しない
 * （FINALでは全体時計を撤廃、各問題は自分自身のtargetTimeMsだけで判定する）。
 *
 * 突入演出（黒→ヒビ→白フラッシュ→黄金世界が砕ける→プリズム/虹色ショックウェーブ→
 * 専用BGM）、1問ごとの成功エフェクト（強度エスカレーション）、Q16「ULTIMATE QUESTION」の
 * 緊急警告演出、TRIAL FAILED/ULTIMATE FAILED演出、200% 真のPERFECT CLEAR演出
 * （ゲーム最大の演出）をすべてここで統括する。
 */
const SILENCE_MS = 280
const FLASH_AT_MS = SILENCE_MS + 350
const SHATTER_AT_MS = FLASH_AT_MS + 150
/** A-2: 「ほぼ無音に近い溜め」の長さ。この直前でduckAudio()を呼び、ちょうどFLASH_AT_MSで
 *  音量が回復し終えるタイミングにsfx.finalEntry()を鳴らす。 */
const DUCK_HOLD_MS = 160
const TEXT1_AT_MS = SHATTER_AT_MS + 420
const TEXT2_AT_MS = TEXT1_AT_MS + 1100
const ENTRY_END_MS = TEXT2_AT_MS + 1000

/** Ver.5.0追加修正: ULTIMATE QUESTION緊急警告演出の内部ビート境界（ms、ultimateIntro開始を0とする）。 */
const ULTIMATE_DARKEN_MS = 320
const ULTIMATE_WARNING_MS = 1000

/**
 * Ver.5.0追加修正(TASK C/D): 200% PERFECT CLEARを「溜め→一撃→世界変化→音楽的ピーク」の
 * OVERDRIVE型構造で全面再構築。100%OVERDRIVE突入より明確に、圧倒的に強い体験にする
 * （通常成功 < FINAL問題成功 < 100%OVERDRIVE < 120%FINAL突入 <<< 200%PERFECT CLEAR）。
 */
const CLEAR200_SILENCE_MS = 320
const CLEAR200_IMPACT_HOLD_MS = 320
const CLEAR200_SLAM_HOLD_MS = 650
const CLEAR200_SLAM_SECOND_IMPACT_MS = 180
/** ファンファーレ開始を基準にした花火の打ち上げタイミング（beat2/beat3/beat4/tailに同期、D-10）。 */
const FIREWORK_WAVE_OFFSETS_MS = [
  0,
  PERFECT_FANFARE_200_TIMING_MS.beat2BrassResponse,
  PERFECT_FANFARE_200_TIMING_MS.beat3HigherPhrase,
  PERFECT_FANFARE_200_TIMING_MS.beat4MajorChord,
  PERFECT_FANFARE_200_TIMING_MS.tailStart,
]

type Clear200Beat = 'silence' | 'impact' | 'slam' | 'fanfare' | null
type FanfareRevealStage = 'percent' | 'perfectClear' | 'title' | 'full'

export function FinalTrialScreen({
  initialStats,
  onFinish,
  startAtQuestion = 1,
  showForceCorrect = false,
  autoForceCorrectDelayMs,
}: Props) {
  const [entryDone, setEntryDone] = useState(startAtQuestion >= FINAL_TRIAL_CONFIG.totalQuestions)
  const [muted, setMutedState] = useState(isMuted())
  const { snapshot, start, handleResult } = useFinalTrial((payload) => {
    onFinish(computeFinalTrialResult(payload, initialStats))
  }, startAtQuestion)

  // 突入演出の各ビート
  const [showCrack, setShowCrack] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [showShatter, setShowShatter] = useState(false)
  const [entryTextBeat, setEntryTextBeat] = useState<'breach' | 'rules' | null>(null)
  const shakeWrapperRef = useRef<HTMLDivElement>(null)
  const entryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // ULTIMATE QUESTION緊急警告演出の内部ビート
  const [ultimateBeat, setUltimateBeat] = useState<'darken' | 'warning' | 'banner' | null>(null)
  const ultimateTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const ultimateFiredRef = useRef(false)

  // 200% CLEARの内部ビート
  const [clear200Beat, setClear200Beat] = useState<Clear200Beat>(null)
  const [fanfareStage, setFanfareStage] = useState<FanfareRevealStage>('percent')
  const [fireworkWave, setFireworkWave] = useState(0)
  const clear200TimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const clear200FiredRef = useRef(false)

  function triggerShake(strong = false) {
    const el = shakeWrapperRef.current
    if (!el) return
    const cls = strong ? 'anim-climax-shake-strong' : 'anim-climax-shake'
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
  }

  useEffect(() => {
    unlockAudio()
    if (startAtQuestion >= FINAL_TRIAL_CONFIG.totalQuestions) {
      // Ver.5.0追加修正: Preview専用（?preview=finalquestion/clear200）。本番の突入演出
      // （120%破壊）は意味を持たないため省略し、entryDoneは初期状態で既にtrueにしてある。
      // start()を呼ぶと、通常プレイでQ15を突破した直後と全く同じ本物の遷移
      // （195%/15/16 CLEAR→ULTIMATE QUESTION緊急警告→実際の問題）がそのまま再生される
      // （52. フェイク版は一切作らず実際のproductionロジックだけを使う）。
      // setTimeout(...,0)で1マクロタスク遅らせるのは、DevのStrictMode（mount→cleanup→mount
      // を同期的に2回実行する）対策。start()をこの効果内で同期的に呼ぶと、1回目のmountで
      // 予約されたsuccessTimerRef側のタイマーが、useFinalTrial内の別effectのcleanupで
      // 即座にclearTimeoutされてしまい、2回目のmountはstartedRefガードで再実行されないため
      // 演出が永久にsuccessFlashで止まってしまう（実際に発見された不具合）。
      entryTimersRef.current.push(setTimeout(start, 0))
      return
    }

    function schedule(fn: () => void, delayMs: number) {
      entryTimersRef.current.push(setTimeout(fn, delayMs))
    }

    schedule(() => setShowCrack(true), SILENCE_MS)
    // A-2: 「既存BGMを急激にduck→約100〜180ms程度ほぼ無音に近い溜め→強いreverse swell...」。
    // duckAudioとsfx.finalEntry()を同時に呼ぶと、finalEntry()自身の音までダッキング対象の
    // sfxGainを通るため無音化されてしまう（実際に発見された不具合）。DUCK_HOLD_MSぶん前倒しで
    // duckAudio()を呼び、そのrecoveryが完了するちょうどFLASH_AT_MSでfinalEntry()を鳴らすことで、
    // 「溜め」が明けた瞬間に全音量でSEが飛び込んでくるようにする。
    schedule(() => duckAudio(DUCK_HOLD_MS, 1), FLASH_AT_MS - DUCK_HOLD_MS)
    schedule(() => {
      setShowFlash(true)
      sfx.finalEntry()
    }, FLASH_AT_MS)
    schedule(() => {
      setShowCrack(false)
      setShowFlash(false)
      setShowShatter(true)
      triggerShake(true)
      // startBgm()は内部でfinalMode/finalIntensityRefを一旦リセットしてしまうため、
      // 必ずstartBgm()を先に呼んでからsetFinalMode(true)する
      // （逆順だとFINAL専用BGMへ切り替わらず、通常BGMのまま鳴り続けてしまう不具合があった）。
      startBgm()
      setFinalMode(true)
      setFinalIntensity(0)
    }, SHATTER_AT_MS)
    schedule(() => setShowShatter(false), SHATTER_AT_MS + 500)
    schedule(() => setEntryTextBeat('breach'), TEXT1_AT_MS)
    schedule(() => setEntryTextBeat('rules'), TEXT2_AT_MS)
    schedule(() => {
      setEntryTextBeat(null)
      setEntryDone(true)
      start()
    }, ENTRY_END_MS)

    return () => entryTimersRef.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 成功演出：問題を突破するたびにSE＋BGM強度を上げる（0〜3段階、questionNumberに連動）。
  useEffect(() => {
    if (snapshot.phase !== 'successFlash' || snapshot.lastClearedNumber === null) return
    const intensity = finalSuccessIntensityFor(snapshot.lastClearedNumber)
    sfx.finalSuccess(intensity)
    setFinalIntensity(Math.min(3, Math.floor(snapshot.lastClearedNumber / 4)))
    if (intensity >= 3) triggerShake(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.judgementKey, snapshot.phase])

  // Ver.5.0追加修正: ULTIMATE QUESTION緊急警告演出（darken→warning→banner）。
  // 15問目クリア直後、実際の問題（Q16）が表示される前に必ず一度だけ流れる。
  useEffect(() => {
    if (snapshot.phase !== 'ultimateIntro') {
      ultimateFiredRef.current = false
      setUltimateBeat(null)
      return
    }
    if (ultimateFiredRef.current) return
    ultimateFiredRef.current = true
    setUltimateBeat('darken')
    // 1. FINAL BGMを急激にduck→暗転→短い静寂
    duckAudio(ULTIMATE_DARKEN_MS, 1)
    function schedule(fn: () => void, delayMs: number) {
      ultimateTimersRef.current.push(setTimeout(fn, delayMs))
    }
    schedule(() => {
      setUltimateBeat('warning')
      sfx.ultimateSiren()
      triggerShake(false)
    }, ULTIMATE_DARKEN_MS)
    schedule(() => {
      setUltimateBeat('banner')
    }, ULTIMATE_DARKEN_MS + ULTIMATE_WARNING_MS)
    return () => ultimateTimersRef.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.phase])

  // Ver.5.0追加修正: ULTIMATE QUESTION（Q16）を実際に回答している間だけ、専用BGMサブモード
  // （ハートビート・低ドローン・警告ビープ）に切り替える。それ以外は通常のFINAL BGMのまま。
  const isUltimateQuestion = snapshot.currentSpec !== null && ULTIMATE_QUESTION_POOL.some((m) => m.id === snapshot.currentSpec!.type)
  useEffect(() => {
    setUltimateMode(snapshot.phase === 'playing' && isUltimateQuestion)
    return () => setUltimateMode(false)
  }, [snapshot.phase, isUltimateQuestion])

  // TRIAL FAILED / ULTIMATE FAILED：失敗音＋BGM停止
  const isUltimateFail = snapshot.phase === 'failed' && snapshot.questionNumber === FINAL_TRIAL_CONFIG.totalQuestions
  useEffect(() => {
    if (snapshot.phase !== 'failed') return
    if (isUltimateFail) {
      sfx.ultimateFail()
    } else {
      sfx.finalMiss()
    }
    stopBgm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.phase])

  // 200% CLEAR：ゲーム最大の演出シーケンス（TASK C/D全面再構築）。
  // 溜め（無音）→一撃（単独最大のsub impact）→200% SLAM（3連続impact）→
  // 多拍構成の勝利ファンファーレ＋段階的テキスト表示＋花火の拍同期、という
  // 「OVERDRIVE型」の構造にする（キラキラを増やすのではなく、巨大な一撃と勝利音楽で勝負する）。
  useEffect(() => {
    if (snapshot.phase !== 'clear200' || clear200FiredRef.current) return
    clear200FiredRef.current = true
    setClear200Beat('silence')
    setFanfareStage('percent')
    // D-1: 全てのBGM/SEを鋭くカットし、250〜350ms程度の完全な無音を作る。
    duckAudio(CLEAR200_SILENCE_MS, 1)
    stopBgm()
    function schedule(fn: () => void, delayMs: number) {
      clear200TimersRef.current.push(setTimeout(fn, delayMs))
    }
    // D-2: 静寂明け、ゲーム単独最大のsub impact。白フラッシュ＋強いshake＋巨大shockwave
    // （Clear200ImpactOverlay自体が全面白フラッシュを兼ねるため、WhiteFlashOverlayは使わない）。
    schedule(() => {
      setClear200Beat('impact')
      sfx.megaImpact()
      triggerShake(true)
    }, CLEAR200_SILENCE_MS)
    // D-3: 「200% SLAM」。数字が叩きつけられ、2発の追加impactが続く。
    schedule(() => {
      setClear200Beat('slam')
      sfx.slamImpact()
      triggerShake(true)
    }, CLEAR200_SILENCE_MS + CLEAR200_IMPACT_HOLD_MS)
    schedule(
      () => {
        sfx.slamImpact()
        triggerShake(false)
      },
      CLEAR200_SILENCE_MS + CLEAR200_IMPACT_HOLD_MS + CLEAR200_SLAM_SECOND_IMPACT_MS,
    )
    // D-4/D-5: SLAMが終わって初めて、本物の勝利ファンファーレ（多拍構成）が始まる。
    const fanfareAt = CLEAR200_SILENCE_MS + CLEAR200_IMPACT_HOLD_MS + CLEAR200_SLAM_HOLD_MS
    schedule(() => {
      setClear200Beat('fanfare')
      sfx.perfectFanfare200()
    }, fanfareAt)
    // D-7/D-8: テキストはファンファーレの拍に同期して段階的に出す（一斉表示にしない）。
    schedule(() => setFanfareStage('perfectClear'), fanfareAt + PERFECT_FANFARE_200_TIMING_MS.beat2BrassResponse)
    schedule(() => setFanfareStage('title'), fanfareAt + PERFECT_FANFARE_200_TIMING_MS.beat4MajorChord)
    schedule(() => setFanfareStage('full'), fanfareAt + PERFECT_FANFARE_200_TIMING_MS.tailStart)
    schedule(() => triggerShake(false), fanfareAt + PERFECT_FANFARE_200_TIMING_MS.beat4MajorChord)
    // D-9/D-10: 花火はファンファーレの拍（brass応答／勝利フレーズ／major chord／余韻）に
    // 同期して複数回打ち上げる。常時最大出力ではなく、拍ごとにメリハリをつける。
    FIREWORK_WAVE_OFFSETS_MS.forEach((offset) => {
      schedule(() => {
        sfx.fireworkBoom()
        setFireworkWave((w) => w + 1)
      }, fanfareAt + offset)
    })
    return () => clear200TimersRef.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.phase])

  useEffect(() => {
    return () => {
      entryTimersRef.current.forEach(clearTimeout)
      ultimateTimersRef.current.forEach(clearTimeout)
      clear200TimersRef.current.forEach(clearTimeout)
      setUltimateMode(false)
      stopBgm()
    }
  }, [])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  function forceCorrect() {
    handleResult({ correct: true, reactionMs: 0 })
  }

  const autoForceFiredRef = useRef(false)
  useEffect(() => {
    if (autoForceCorrectDelayMs === undefined || autoForceFiredRef.current) return
    if (!entryDone || snapshot.phase !== 'playing' || !snapshot.currentSpec) return
    autoForceFiredRef.current = true
    const t = setTimeout(() => handleResult({ correct: true, reactionMs: 0 }), autoForceCorrectDelayMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDone, snapshot.phase, snapshot.currentSpec])

  const CurrentQuestion = snapshot.currentSpec ? FINAL_QUESTION_MODULES[snapshot.currentSpec.type]?.Component : null
  const intensity = snapshot.lastClearedNumber !== null ? finalSuccessIntensityFor(snapshot.lastClearedNumber) : 1
  // Ver.5.0追加修正: 通常=紫、OVERDRIVE=黄金、FINAL DOPA TRIAL(Q1-15)=黒＋白＋プリズムに対し、
  // ULTIMATE QUESTION（突入演出中〜Q16回答中）だけは赤＋黒＋非常警告の専用世界観にする。
  const showUltimateWorld = snapshot.phase === 'ultimateIntro' || (snapshot.phase === 'playing' && isUltimateQuestion)

  if (!entryDone) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-2 overflow-hidden bg-black px-6 text-center">
        <FinalWorldAmbience />
        <HudCrackOverlay show={showCrack} />
        <WorldShatterOverlay show={showShatter} />
        <FinalEntryTextOverlay beat={entryTextBeat} />
        <WhiteFlashOverlay show={showFlash} />
        <RainbowShockwaveOverlay show={showShatter} />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      {showUltimateWorld ? <UltimateWorldAmbience /> : <FinalWorldAmbience />}

      <div className="relative z-30 flex items-start justify-between px-5 pt-3 pb-1">
        <button onClick={toggleMute} className="text-lg opacity-70" aria-label="ミュート切り替え">
          {muted ? '🔇' : '🔊'}
        </button>
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold tracking-widest text-white/50">FINAL DOPA TRIAL</p>
          <p className="text-4xl font-black tabular-nums text-amber-300">
            {snapshot.percent}
            <span className="text-xl">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">TRIAL</p>
          <p className="text-xl font-black tabular-nums text-white">{Math.min(snapshot.questionNumber, 16)} / 16</p>
        </div>
      </div>

      <div ref={shakeWrapperRef} className="relative z-10 flex flex-1 items-center justify-center">
        {snapshot.phase === 'playing' && CurrentQuestion && snapshot.currentSpec && (
          <div key={snapshot.currentSpec.instanceId} className="h-full w-full">
            <CurrentQuestion spec={snapshot.currentSpec} onResult={handleResult} />
          </div>
        )}
        {snapshot.phase === 'successFlash' && (
          <>
            <FinalSuccessBurst judgementKey={snapshot.judgementKey} intensity={intensity} />
            {snapshot.milestoneLabel && (
              <p
                key={snapshot.judgementKey}
                className="anim-pop relative text-3xl font-black tracking-widest text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.8)]"
              >
                {snapshot.milestoneLabel}
              </p>
            )}
          </>
        )}
        {snapshot.phase === 'ultimateIntro' && <UltimateIntroOverlay beat={ultimateBeat} />}
        {snapshot.phase === 'clear200' && (
          <>
            <Clear200SlamOverlay show={clear200Beat === 'slam'} />
            <GoldenClearOverlay
              show={clear200Beat === 'fanfare'}
              percent={200}
              title="DOPA PERFECT"
              showPerfectClearWording
              revealStage={fanfareStage}
            />
            <RainbowShockwaveOverlay show={clear200Beat === 'fanfare'} />
            <Confetti120Overlay show={clear200Beat === 'fanfare'} />
            <Sparkle120Overlay show={clear200Beat === 'fanfare'} />
            <Fireworks200Overlay show={clear200Beat === 'fanfare'} wave={fireworkWave} />
          </>
        )}
      </div>

      <FinalFailOverlay
        show={snapshot.phase === 'failed'}
        percent={snapshot.percent}
        clearedCount={Math.max(0, snapshot.questionNumber - 1)}
        label={isUltimateFail ? 'ULTIMATE FAILED' : 'TRIAL FAILED'}
      />
      <WhiteFlashOverlay show={showFlash} />
      <Clear200ImpactOverlay show={snapshot.phase === 'clear200' && clear200Beat === 'impact'} />

      {showForceCorrect && snapshot.phase === 'playing' && (
        <button
          onClick={forceCorrect}
          className="fixed bottom-4 right-4 z-[60] rounded-full bg-fuchsia-600/90 px-3 py-2 text-[11px] font-black text-white shadow-lg"
        >
          ⏩ 強制正解（Preview）
        </button>
      )}
    </div>
  )
}
