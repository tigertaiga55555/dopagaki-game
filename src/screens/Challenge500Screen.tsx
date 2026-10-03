import { useEffect, useRef, useState } from 'react'
import { Challenge500QaPanel } from '../dev/Challenge500QaPanel'
import { Challenge500CorrectFx, type Challenge500CorrectFxHandle } from '../components/Challenge500CorrectFx'
import { Challenge500TimerBar } from '../components/Challenge500TimerBar'
import { QuitButton } from '../components/QuitButton'
import {
  Confetti120Overlay,
  getOverdriveFrameClass,
  GoldenClearOverlay,
  OverdriveAmbience,
  RainbowShockwaveOverlay,
  Sparkle120Overlay,
  WhiteFlashOverlay,
  type OverdriveTier,
} from '../components/OverdriveFx'
import { CHALLENGE500_CONFIG, tierForPercent } from '../config/challenge500Config'
import type { Challenge500State } from '../engine/challenge500Engine'
import { useChallenge500 } from '../engine/useChallenge500'
import { CHALLENGE500_QUESTION_MODULES } from '../questions/challenge500'
import type { Challenge500QuestionResult } from '../questions/challenge500/types'
import { sfx } from '../utils/sound'

interface Props {
  onFinish: (state: Challenge500State) => void
  onQuit: () => void
  /**
   * Preview専用のQA補助モード（既定false）。__DOPAGAKI_PREVIEW_ENABLED__
   * （Productionビルドでは常にリテラルfalseにインライン化される）と合わせて二重に
   * ガードしており、本番のApp.tsx通常プレイ経路からは絶対にtrueを渡さない。
   * trueの場合のみ画面左下にQA操作パネル（％ジャンプ・強制正解/MISS・演出プレビュー）を
   * 表示し、useChallenge500のGA4送信（challenge_500_start/reach_300/400/500）を抑制する。
   * 500〜200%本体のゲームロジック・難易度・問題内容には一切手を加えない。
   */
  qaMode?: boolean
}

const END_FLASH_MS = 900
/** 500%完全クリアは「数秒程度しっかり見せても構わない」という指示のため、2段構成で長めに見せる。 */
const CLEAR_FIRST_BEAT_MS = 700
const CLEAR_BLACKOUT_MS = 200
const CLEAR_SECOND_BEAT_MS = 3500
const CLEAR_FLASH_MS = CLEAR_FIRST_BEAT_MS + CLEAR_BLACKOUT_MS + CLEAR_SECOND_BEAT_MS
/** 300%より明確に強く・長く見せる。 */
const CHECKPOINT_300_MS = 2200
const CHECKPOINT_400_MS = 2800

function hapticPulse(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
}

/**
 * パフォーマンス最適化: index.cssの.anim-climax-shake / .anim-climax-shake-strongと
 * 全く同じキーフレームだが、classList.remove→void el.offsetWidth（強制同期リフロー）→
 * classList.addという旧方式をやめ、Web Animations APIで直接再生する。
 * 旧方式は「同じクラスを連続で再適用してもブラウザがアニメーションの再発火に気づけない」
 * 問題を強制リフローで回避していたが、このoffsetWidth読み出しはメインスレッドを
 * 同期的にブロックするレイアウト計算を強制するため、正解判定ハンドラ内（スコア更新・
 * 次問生成・SE再生と同じ呼び出しスタック）で毎回実行されるとiPhone実機で可視的な
 * コマ落ちの原因になっていた。Animation.cancel()→新規animate()は強制リフローなしで
 * 同じ「連打しても毎回最初から揺れ直す」挙動を実現できる。見た目（移動量・tangent・
 * 時間）は旧CSSと完全に同一。
 */
const CLIMAX_SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: 'translate(0, 0)', offset: 0 },
  { transform: 'translate(-6px, 2px)', offset: 0.2 },
  { transform: 'translate(5px, -3px)', offset: 0.4 },
  { transform: 'translate(-4px, 3px)', offset: 0.6 },
  { transform: 'translate(3px, -2px)', offset: 0.8 },
  { transform: 'translate(0, 0)', offset: 1 },
]
const CLIMAX_SHAKE_STRONG_KEYFRAMES: Keyframe[] = [
  { transform: 'translate(0, 0)', offset: 0 },
  { transform: 'translate(-12px, 5px)', offset: 0.15 },
  { transform: 'translate(10px, -7px)', offset: 0.3 },
  { transform: 'translate(-9px, 6px)', offset: 0.45 },
  { transform: 'translate(8px, -5px)', offset: 0.6 },
  { transform: 'translate(-5px, 3px)', offset: 0.75 },
  { transform: 'translate(3px, -2px)', offset: 0.9 },
  { transform: 'translate(0, 0)', offset: 1 },
]
/** index.cssの.anim-spike（spike-pop 0.5s ease-out）と同じキーフレーム。 */
const SPIKE_KEYFRAMES: Keyframe[] = [
  { transform: 'scale(1)', offset: 0 },
  { transform: 'scale(1.18)', offset: 0.4 },
  { transform: 'scale(1)', offset: 1 },
]

type CheckpointBeat = 'flash300' | 'flash400' | null
type ClearBeat = 'first' | 'blackout' | 'second' | null

/**
 * Ver.6 Phase 1（演出強化版）: 200〜500%「限界突破チャレンジ」の実プレイ画面。
 *
 * 演出強化: 100% DOPA OVERDRIVE演出（PlayScreen/OverdriveFx.tsx）を正式な基準とし、
 * そこで使われている視覚コンポーネント（GoldenClearOverlay/WhiteFlashOverlay/
 * RainbowShockwaveOverlay/Confetti120Overlay/Sparkle120Overlay/OverdriveAmbience、
 * いずれも120%/200%到達時にも使われる「OVERDRIVE以上」の実績ある演出）をそのまま
 * 再利用し、300%/400%チェックポイント・500%クリアの演出密度を底上げする
 * （新しい演出を弱く作るより、既に気持ちいいと実証済みの既存演出を再利用・発展させる
 * というユーザー指示に基づく）。既存コンポーネント自体は一切変更しない
 * （通常ゲーム・FINAL DOPA TRIALの演出に影響を与えないため）。
 *
 * ゲームロジック（11系統の問題・反転混在比率・固定4.5秒・tier別MISSペナルティ・
 * チェックポイント・色覚アクセシビリティ・QAモード）は一切変更しない。
 */
export function Challenge500Screen({ onFinish, onQuit, qaMode = false }: Props) {
  const [finalState, setFinalState] = useState<Challenge500State | null>(null)
  const { snapshot, start, handleResult, jumpTo } = useChallenge500((state) => setFinalState(state), { qaMode })
  const startedRef = useRef(false)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showQaPanel = qaMode && __DOPAGAKI_PREVIEW_ENABLED__
  const shakeWrapperRef = useRef<HTMLDivElement>(null)

  const [checkpointBeat, setCheckpointBeat] = useState<CheckpointBeat>(null)
  const checkpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clearBeat, setClearBeat] = useState<ClearBeat>(null)
  const clearTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const correctFxRef = useRef<Challenge500CorrectFxHandle>(null)
  const dopaTextRef = useRef<HTMLParagraphElement>(null)
  const shakeAnimRef = useRef<Animation | null>(null)

  const tier = tierForPercent(snapshot.state.percent)
  /** 100% OVERDRIVE用のtier（0〜4）に200〜400%を写像し、既存の常駐演出（サイレン・粒子・枠の発光）を
   *  tierが上がるほど強くする。200%でも控えめな発光は常に出す（「通常の焦り音」に対応する視覚）。 */
  const ambienceTier: OverdriveTier = tier === 1 ? 2 : tier === 2 ? 3 : 4

  function triggerShake(strong = false) {
    const el = shakeWrapperRef.current
    if (!el) return
    shakeAnimRef.current?.cancel()
    shakeAnimRef.current = el.animate(strong ? CLIMAX_SHAKE_STRONG_KEYFRAMES : CLIMAX_SHAKE_KEYFRAMES, {
      duration: strong ? 400 : 180,
      easing: 'ease-in-out',
    })
  }

  /**
   * タップでの正解/MISS判定（各問題コンポーネント自身のonPointerDown経由）と、
   * Challenge500TimerBarの時間切れ（onTimeout）は、どちらが先に解決するか分からない
   * 競合状態にある。resolvedRefで「この問題インスタンスについて、どちらか一方が
   * 既にhandleResultを呼んだか」を管理し、2回目以降の呼び出しは無視する
   * （例: 時間切れでMISS確定した直後に、表示上まだ残っていたタップが遅れて届いても
   * 二重にhandleResultが呼ばれない）。この問題インスタンス用のTimerBar（焦り警告音の
   * setTimeoutチェーンを含む）は、問題が解決すると同時に親要素ごとアンマウントされるため、
   * 「正解した瞬間に焦り音を即停止する」が追加実装なしで成立する。
   */
  const resolvedRef = useRef(false)
  useEffect(() => {
    resolvedRef.current = false
  }, [snapshot.currentSpec?.instanceId])

  function guardedHandleResult(result: Challenge500QuestionResult) {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (result.correct) {
      sfx.challenge500Correct(tier)
      hapticPulse([10, 30, 10])
      /**
       * パフォーマンス最適化: 見た目のシェイク・sparkleバースト・DOPA%の弾みは、
       * スコア更新＋次問生成（下のhandleResult、Reactの再コミットで問題tree全体が
       * 入れ替わる重い処理）と同じフレームで行わず、次のアニメーションフレームへ
       * 1回分だけずらす。体感のテンポ（正解→次問の速さ）はrAF 1回分（約16ms）では
       * 変わらないが、「問題の切り替え」と「演出の発火」という2つの重いDOM更新が
       * 同一フレームに重なってiPhone実機でカクつく問題を避けられる。
       */
      requestAnimationFrame(() => {
        triggerShake(false)
        correctFxRef.current?.trigger()
        const dopaEl = dopaTextRef.current
        if (dopaEl) {
          dopaEl.getAnimations().forEach((anim) => anim.cancel())
          dopaEl.animate(SPIKE_KEYFRAMES, { duration: 500, easing: 'ease-out' })
        }
      })
    } else {
      sfx.challenge500Miss(tier)
      hapticPulse(40)
    }
    handleResult(result)
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 300%/400%チェックポイントに到達した瞬間、ゲームを一度止めて専用演出を挟む。
   * floorは実プレイでは単調増加のため、この依存配列ベースの発火は現実のプレイでは
   * 各チェックポイントにつき必ず一度だけ起こる（200→300→400と一方向にしか進まない）。
   * QAのジャンプ機能でfloorを行き来させた場合は、floorが実際に変化するたびに
   * 再度この演出が発火する——「300/400の演出を毎回ゲームを進めずに見返したい」という
   * QA要件を、ジャンプボタン自体の自然な挙動として満たすための意図的な設計。
   */
  useEffect(() => {
    if (snapshot.state.floor >= 400) {
      setCheckpointBeat('flash400')
      sfx.challenge500Checkpoint400()
      hapticPulse([30, 40, 30, 40, 30, 120])
      triggerShake(true)
      checkpointTimerRef.current = setTimeout(() => setCheckpointBeat(null), CHECKPOINT_400_MS)
    } else if (snapshot.state.floor >= 300) {
      setCheckpointBeat('flash300')
      sfx.challenge500Checkpoint300()
      hapticPulse([20, 30, 20, 60])
      triggerShake(false)
      checkpointTimerRef.current = setTimeout(() => setCheckpointBeat(null), CHECKPOINT_300_MS)
    }
    return () => {
      if (checkpointTimerRef.current) clearTimeout(checkpointTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.state.floor])

  useEffect(() => {
    if (!finalState) return
    hapticPulse(finalState.cleared ? [40, 60, 40, 60, 40, 60, 150] : 50)
    if (!finalState.cleared) {
      finishTimerRef.current = setTimeout(() => onFinish(finalState), END_FLASH_MS)
      return () => {
        if (finishTimerRef.current) clearTimeout(finishTimerRef.current)
      }
    }
    // 500%完全クリア：OVERDRIVE級の爆発を2段重ねる（第1波→暗転→第2波）。
    sfx.challenge500Clear500()
    setClearBeat('first')
    triggerShake(true)
    clearTimersRef.current.push(
      setTimeout(() => setClearBeat('blackout'), CLEAR_FIRST_BEAT_MS),
      setTimeout(() => {
        setClearBeat('second')
        triggerShake(true)
      }, CLEAR_FIRST_BEAT_MS + CLEAR_BLACKOUT_MS),
      setTimeout(() => onFinish(finalState), CLEAR_FLASH_MS),
    )
    return () => {
      clearTimersRef.current.forEach(clearTimeout)
      clearTimersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalState])

  const CurrentQuestion = snapshot.currentSpec ? CHALLENGE500_QUESTION_MODULES.find((m) => m.id === snapshot.currentSpec!.type)?.Component : null
  const showingQuestion = !finalState && !checkpointBeat && CurrentQuestion && snapshot.currentSpec

  return (
    <div
      ref={shakeWrapperRef}
      className={`relative flex min-h-dvh flex-col overflow-hidden bg-black ${getOverdriveFrameClass(ambienceTier)}`}
    >
      <OverdriveAmbience tier={ambienceTier} />
      <QuitButton onQuit={onQuit} />

      <div className="relative z-30 flex items-start justify-between px-5 pt-3 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-white/40">限界突破チャレンジ</p>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">DOPA</p>
          <p ref={dopaTextRef} className="text-4xl font-black tabular-nums text-amber-300">
            {snapshot.state.percent}
            <span className="text-xl">%</span>
          </p>
        </div>
      </div>

      {snapshot.state.floor > CHALLENGE500_CONFIG.startPercent && !checkpointBeat && (
        <p className="relative z-30 text-center text-[11px] font-black text-emerald-300">
          CHECKPOINT {snapshot.state.floor}% 確保済み
        </p>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {showingQuestion && (
          <div key={snapshot.currentSpec!.instanceId} className="flex h-full w-full flex-col">
            <div className="flex justify-center px-8 pb-2">
              <Challenge500TimerBar
                limitMs={CHALLENGE500_CONFIG.questionTimeLimitMs}
                tier={tier}
                onTimeout={() => guardedHandleResult({ correct: false })}
              />
            </div>
            <div className="flex-1">
              <CurrentQuestion spec={snapshot.currentSpec!} onResult={guardedHandleResult} />
            </div>
          </div>
        )}

        {checkpointBeat && <CheckpointOverlay beat={checkpointBeat} />}

        {finalState && (
          <Clear500Overlay beat={clearBeat} finalState={finalState} />
        )}
      </div>

      <Challenge500CorrectFx ref={correctFxRef} />

      {showQaPanel && !finalState && !checkpointBeat && (
        <Challenge500QaPanel
          onJump={jumpTo}
          onForceCorrect={() => guardedHandleResult({ correct: true })}
          onForceMiss={() => guardedHandleResult({ correct: false })}
        />
      )}
    </div>
  )
}

/**
 * 300%/400%チェックポイント演出。100% DOPA OVERDRIVE演出で使われている
 * WhiteFlashOverlay/RainbowShockwaveOverlay/GoldenClearOverlay/Confetti120Overlay/
 * Sparkle120Overlayをそのまま再利用し、400%は300%より保持時間が長く（呼び出し元の
 * CHECKPOINT_400_MS > CHECKPOINT_300_MS）、かつ画面シェイクが強い（triggerShake(true)）
 * ことで明確に格上に見せる。色だけに依存しないよう、情報は文字そのもので伝える
 * （CHECKPOINT SECURED等）。
 */
function CheckpointOverlay({ beat }: { beat: 'flash300' | 'flash400' }) {
  const is400 = beat === 'flash400'
  const percent = is400 ? 400 : 300
  const title = is400 ? 'FINAL CHECKPOINT' : 'CHECKPOINT SECURED'
  const hint = is400 ? 'ここから1 MISSで終了。あと100%——' : '下線反転、最大2箇所——'
  return (
    <>
      <WhiteFlashOverlay show />
      <RainbowShockwaveOverlay show />
      <GoldenClearOverlay show percent={percent} title={title} />
      <Confetti120Overlay show />
      <Sparkle120Overlay show />
      <p className="pointer-events-none absolute inset-x-0 bottom-12 z-[53] px-6 text-center text-xs font-bold text-white/70">{hint}</p>
    </>
  )
}

/**
 * 500% ABSOLUTE CLEAR演出。ゲーム最高到達点のため、100% OVERDRIVEより明確に強い
 * 「OVERDRIVE級の爆発を2段重ねる」構成にする：第1波（DOPA 500%）→一瞬暗転→
 * 第2波（ABSOLUTE CLEAR＋LIMIT BREAK COMPLETE）。既存の200%到達と同格以上の
 * 演出コンポーネント一式を両波でフル稼働させる。
 */
function Clear500Overlay({ beat, finalState }: { beat: ClearBeat; finalState: Challenge500State }) {
  if (!finalState.cleared) {
    return (
      <div className="anim-pop flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-black tracking-widest text-white/50">CHALLENGE END</p>
        <p className="text-5xl font-black tabular-nums text-amber-300">{finalState.percent}%</p>
      </div>
    )
  }
  if (beat === 'blackout') {
    return <div className="pointer-events-none absolute inset-0 z-50 bg-black" />
  }
  const isSecond = beat === 'second'
  return (
    <>
      <WhiteFlashOverlay show />
      <RainbowShockwaveOverlay show />
      <GoldenClearOverlay show percent={500} title={isSecond ? 'ABSOLUTE CLEAR' : 'DOPA 500%'} />
      <Confetti120Overlay show />
      <Sparkle120Overlay show />
      {isSecond && (
        <p className="pointer-events-none absolute inset-x-0 bottom-12 z-[53] px-6 text-center text-sm font-black tracking-widest text-white/80">
          LIMIT BREAK COMPLETE
        </p>
      )}
    </>
  )
}
