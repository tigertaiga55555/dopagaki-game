import { useEffect, useRef, useState } from 'react'
import {
  Clear200PreludeOverlay,
  Fireworks200Overlay,
  FinalEntryTextOverlay,
  FinalFailOverlay,
  FinalQuestionIntroOverlay,
  FinalSuccessBurst,
  FinalWorldAmbience,
  HudCrackOverlay,
  WorldShatterOverlay,
} from '../components/FinalFx'
import { Confetti120Overlay, GoldenClearOverlay, RainbowShockwaveOverlay, Sparkle120Overlay, WhiteFlashOverlay } from '../components/OverdriveFx'
import { FINAL_TRIAL_CONFIG } from '../config/finalTrialConfig'
import { computeFinalTrialResult } from '../engine/resultEngineV4'
import { finalSuccessIntensityFor, useFinalTrial } from '../engine/useFinalTrial'
import { FINAL_QUESTION_MODULES } from '../questions/final'
import { duckAudio, unlockAudio } from '../utils/audioContext'
import { setFinalIntensity, setFinalMode, startBgm, stopBgm } from '../utils/bgm'
import { isMuted, setMuted, sfx } from '../utils/sound'
import type { FinalResultV4, PlayStats } from '../types'

interface Props {
  initialStats: PlayStats
  onFinish: (result: FinalResultV4) => void
  /** Ver.5.0: 通常は1（Q1から開始）。Previewの?preview=finalquestion/clear200だけ16を渡し、
   *  FINAL QUESTION（箱シャッフル）から直接プレビューできるようにする。 */
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
   * （＝startAtQuestion=16のFINAL QUESTION）に対して、この遅延後に自動でforceCorrect相当の
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
 * 専用BGM）、1問ごとの成功エフェクト（強度エスカレーション）、TRIAL FAILED演出、
 * 200% 真のPERFECT CLEAR演出（ゲーム最大の演出）をすべてここで統括する。
 */
const SILENCE_MS = 280
const FLASH_AT_MS = SILENCE_MS + 350
const SHATTER_AT_MS = FLASH_AT_MS + 150
const TEXT1_AT_MS = SHATTER_AT_MS + 420
const TEXT2_AT_MS = TEXT1_AT_MS + 1100
const ENTRY_END_MS = TEXT2_AT_MS + 1000
/** startAtQuestion===16（Preview専用）でFINAL QUESTIONへ直接入る場合の簡易導入表示時間。 */
const DIRECT_Q16_INTRO_MS = 1300

const CLEAR200_SILENCE_MS = 280
const CLEAR200_PRELUDE_MS = 260
const CLEAR200_FLASH_HOLD_MS = 300

export function FinalTrialScreen({
  initialStats,
  onFinish,
  startAtQuestion = 1,
  showForceCorrect = false,
  autoForceCorrectDelayMs,
}: Props) {
  const [entryDone, setEntryDone] = useState(false)
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

  // 200% CLEARの内部ビート
  const [clear200Beat, setClear200Beat] = useState<'silence' | 'prelude' | 'climax' | null>(null)
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
      // Preview専用の簡易導入（finalquestion/clear200プレビュー）：本番の突入演出（120%破壊）は
      // 意味を持たないため省略し、Q16の前に必ず流れるFINAL QUESTION中継演出だけを見せてから
      // 実際にstart()する（＝実際のFinalQuestionBoxModuleがそのまま出題される）。
      const t = setTimeout(() => {
        setEntryDone(true)
        start()
      }, DIRECT_Q16_INTRO_MS)
      entryTimersRef.current.push(t)
      return () => entryTimersRef.current.forEach(clearTimeout)
    }

    function schedule(fn: () => void, delayMs: number) {
      entryTimersRef.current.push(setTimeout(fn, delayMs))
    }

    schedule(() => setShowCrack(true), SILENCE_MS)
    schedule(() => {
      duckAudio(400, 1)
      setShowFlash(true)
      sfx.finalEntry()
    }, FLASH_AT_MS)
    schedule(() => {
      setShowCrack(false)
      setShowFlash(false)
      setShowShatter(true)
      triggerShake(true)
      setFinalMode(true)
      setFinalIntensity(0)
      startBgm()
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

  // TRIAL FAILED：失敗音＋BGM停止
  useEffect(() => {
    if (snapshot.phase !== 'failed') return
    sfx.finalMiss()
    stopBgm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.phase])

  // 200% CLEAR：ゲーム最大の演出シーケンス（45. 冷凍→無音→200→白閃光→黄金爆発→
  // プリズム爆発→複数の虹色ショックウェーブ→画面shake→紙吹雪→花火→星→sparkle→
  // 専用超大型ファンファーレ→巨大テキスト、数秒の余韻）。
  useEffect(() => {
    if (snapshot.phase !== 'clear200' || clear200FiredRef.current) return
    clear200FiredRef.current = true
    setClear200Beat('silence')
    duckAudio(CLEAR200_SILENCE_MS, 1)
    function schedule(fn: () => void, delayMs: number) {
      clear200TimersRef.current.push(setTimeout(fn, delayMs))
    }
    schedule(() => setClear200Beat('prelude'), CLEAR200_SILENCE_MS)
    schedule(() => {
      setClear200Beat('climax')
      setShowFlash(true)
      sfx.overdriveMax()
      sfx.perfectFanfare200()
      triggerShake(true)
      stopBgm()
    }, CLEAR200_SILENCE_MS + CLEAR200_PRELUDE_MS)
    schedule(() => setShowFlash(false), CLEAR200_SILENCE_MS + CLEAR200_PRELUDE_MS + CLEAR200_FLASH_HOLD_MS)
    return () => clear200TimersRef.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.phase])

  useEffect(() => {
    return () => {
      entryTimersRef.current.forEach(clearTimeout)
      clear200TimersRef.current.forEach(clearTimeout)
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

  if (!entryDone) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-2 overflow-hidden bg-black px-6 text-center">
        <FinalWorldAmbience />
        {startAtQuestion >= FINAL_TRIAL_CONFIG.totalQuestions ? (
          <FinalQuestionIntroOverlay show />
        ) : (
          <>
            <HudCrackOverlay show={showCrack} />
            <WorldShatterOverlay show={showShatter} />
            <FinalEntryTextOverlay beat={entryTextBeat} />
          </>
        )}
        <WhiteFlashOverlay show={showFlash} />
        <RainbowShockwaveOverlay show={showShatter} />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <FinalWorldAmbience />

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
        {snapshot.phase === 'finalQuestionIntro' && <FinalQuestionIntroOverlay show />}
        {snapshot.phase === 'clear200' && (
          <>
            <Clear200PreludeOverlay show={clear200Beat === 'prelude'} />
            <GoldenClearOverlay show={clear200Beat === 'climax'} percent={200} title="DOPA PERFECT" showPerfectClearWording />
            <RainbowShockwaveOverlay show={clear200Beat === 'climax'} />
            <Confetti120Overlay show={clear200Beat === 'climax'} />
            <Sparkle120Overlay show={clear200Beat === 'climax'} />
            <Fireworks200Overlay show={clear200Beat === 'climax'} />
          </>
        )}
      </div>

      <FinalFailOverlay show={snapshot.phase === 'failed'} percent={snapshot.percent} clearedCount={Math.max(0, snapshot.questionNumber - 1)} />
      <WhiteFlashOverlay show={showFlash} />

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
