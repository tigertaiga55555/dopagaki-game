import { useEffect, useRef, useState } from 'react'
import { Challenge500QaPanel } from '../dev/Challenge500QaPanel'
import { Challenge500AmbientFX } from '../components/Challenge500AmbientFX'
import { Challenge500CorrectFx, type Challenge500CorrectFxHandle } from '../components/Challenge500CorrectFx'
import { Challenge500TimerBar } from '../components/Challenge500TimerBar'
import { QuitButton } from '../components/QuitButton'
import {
  Confetti120Overlay,
  GoldenClearOverlay,
  RainbowShockwaveOverlay,
  Sparkle120Overlay,
  WhiteFlashOverlay,
} from '../components/OverdriveFx'
import { CHALLENGE500_CONFIG, tierForPercent } from '../config/challenge500Config'
import { getChallenge500Theme } from '../config/challenge500Theme'
import type { Challenge500State } from '../engine/challenge500Engine'
import { useChallenge500 } from '../engine/useChallenge500'
import { CHALLENGE500_QUESTION_MODULES } from '../questions/challenge500'
import type { Challenge500QuestionResult } from '../questions/challenge500/types'
import { duckAudio, duckBgm } from '../utils/audioContext'
import { setChallenge500Mode, setChallenge500Tier, startBgm, stopBgm } from '../utils/bgm'
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
/** チェックポイント到達時、常駐ハートビートだけを一旦止める長さ（SE自体は別バスで無傷）。 */
const CHECKPOINT_DUCK_MS = 900
/**
 * Ver.6 Phase 2: 490%（あと1問で500%）専用の「最終問題への予告」演出。
 * 300/400チェックポイントより短く終わらせる（「派手さより緊張感」「テンポを壊さない」
 * という指示のため、保持時間そのものはチェックポイントより短い）。
 */
const FINAL_QUESTION_490_MS = 1300
const FINAL_QUESTION_DUCK_MS = 500
/**
 * Ver.6 Phase 2: 500%クリアの「静寂→爆発」のための無音区間。duckAudio()でSE/BGM両方を
 * 一度沈黙させ、その沈黙が明けた瞬間にchallenge500Clear500()（爆発インパクト）を鳴らす
 * ——200% CLEAR（FinalTrialScreen側のCLEAR200_SILENCE_MS=320と同じ考え方）を踏襲する。
 */
const CLEAR500_SILENCE_MS = 300

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
 * Ver.6 Phase 3（演出全面再構築版）: 200〜500%「限界突破チャレンジ」の実プレイ画面。
 *
 * 実機QA指示: 200/300/400%台を「同じ演出部品の強弱」だけで作らず、帯域ごとに
 * 別の「人格」を持たせる——200台=LIMIT BREAK（金）/300台=OVERLOAD（電気的な水色）/
 * 400台=DANGER ZONE（赤の警告）/490%=FINAL QUESTION（静寂）。常駐アンビエントは
 * config/challenge500Theme.ts（純粋な計算）が算出したパラメータを
 * components/Challenge500AmbientFX.tsxへ渡すだけの構成にし、場当たり的な
 * useEffect追加でこのファイルが肥大化しないよう責務を分離した。
 *
 * confetti/rainbow/golden burst（Confetti120Overlay/RainbowShockwaveOverlay/
 * GoldenClearOverlay）は500% ABSOLUTE CLEAR専用に予約し、300/400チェックポイントでは
 * 使わない（途中の演出と500%の演出を「同じ種類のエフェクトの量違い」にしないため）。
 * これらのコンポーネント自体は一切変更しない（通常ゲーム・FINAL DOPA TRIALの演出に
 * 影響を与えないため）。
 *
 * ゲームロジック（11系統の問題・反転混在比率・tier別MISSペナルティ・チェックポイント・
 * 色覚アクセシビリティ・QAモード）は一切変更しない。制限時間はCHALLENGE500_CONFIG側で
 * 4.5秒→3.8秒へ調整済み（このファイルは値を参照するだけ）。
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
  const [showFinalQuestionBeat, setShowFinalQuestionBeat] = useState(false)
  const finalQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clearBeat, setClearBeat] = useState<ClearBeat>(null)
  const clearTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const correctFxRef = useRef<Challenge500CorrectFxHandle>(null)
  const dopaTextRef = useRef<HTMLParagraphElement>(null)
  const shakeAnimRef = useRef<Animation | null>(null)

  const tier = tierForPercent(snapshot.state.percent)
  /**
   * 490%（あと1問で500%）の間はずっと「静寂」テーマにする。showFinalQuestionBeat
   * （490到達直後の短い演出ビートだけ）とは別に、percent===490である間は常にtrueになる
   * ため、ビート終了後に最後の問題を表示している間もアンビエントは静かなまま維持される
   * （400%台の騒がしさを「足す」のではなく「引く」という指示のため）。
   */
  const isFinalQuestionPhase = snapshot.state.percent === 490
  const theme = getChallenge500Theme(tier, snapshot.state.percent, isFinalQuestionPhase)

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
        correctFxRef.current?.trigger(theme.colorRgb)
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
   * Ver.6 Phase 2: 実機フィードバック「500%チャレンジが静かすぎる」への対応。
   * 0〜100%通常モードのFINAL DOPA TRIAL専用BGM（finalMode、bgm.ts）と全く同じ
   * ハートビート/ハイハット/金属パーカッション/不穏パッドのインストゥルメントを再利用した
   * 常駐アンビエント（setChallenge500Mode）を、この画面が表示されている間ずっと鳴らす。
   * 正解/MISS/チェックポイント/焦りビープといった単発SEは既存どおりsfxGain側のまま
   * （この常駐アンビエントはbgmGain側の別バスのため、互いの音量を奪わない）。
   * startBgm()は内部で各BGMモードを一旦リセットするため、必ず先に呼んでから
   * setChallenge500Mode(true)する（bgm.ts側のコメントと同じ注意点）。
   */
  useEffect(() => {
    startBgm()
    setChallenge500Mode(true)
    return () => {
      setChallenge500Mode(false)
      stopBgm()
    }
  }, [])

  /** tierが変わるたび（チェックポイント到達・QAジャンプのいずれでも）即座にアンビエントの密度を更新する。 */
  useEffect(() => {
    setChallenge500Tier(tier)
  }, [tier])

  /**
   * 300%/400%チェックポイントに到達した瞬間、ゲームを一度止めて専用演出を挟む。
   * floorは実プレイでは単調増加のため、この依存配列ベースの発火は現実のプレイでは
   * 各チェックポイントにつき必ず一度だけ起こる（200→300→400と一方向にしか進まない）。
   * QAのジャンプ機能でfloorを行き来させた場合は、floorが実際に変化するたびに
   * 再度この演出が発火する——「300/400の演出を毎回ゲームを進めずに見返したい」という
   * QA要件を、ジャンプボタン自体の自然な挙動として満たすための意図的な設計。
   *
   * ただしpercentが490の場合（QAで200%から直接「490」へジャンプすると、floorも
   * 300/400を経由せず一気に400へ確保されるため、この効果とFINAL QUESTION490%効果が
   * 同一レンダーで同時に発火し得る）はチェックポイント演出を出さない。490%の瞬間は
   * 下のFINAL QUESTION演出がより具体的・優先度の高いメッセージのため、二重表示を
   * 避けてそちらに譲る（実プレイでは400%確保と490%到達は必ず別タイミングで起こるため、
   * この分岐が通常プレイの演出に影響することはない）。
   */
  useEffect(() => {
    if (snapshot.state.percent === 490) return
    if (snapshot.state.floor >= 400) {
      // 常駐ハートビートだけを一旦止め（SEは別バスなので無傷）、「場面転換」を音でも作る。
      // tierは下のuseEffect（[tier]）で既に次段へ切り替わっているため、ダッキングが
      // 明けた頃には次tier用の、より濃いアンビエントが鳴っている。
      duckBgm(CHECKPOINT_DUCK_MS, 1)
      setCheckpointBeat('flash400')
      sfx.challenge500Checkpoint400()
      hapticPulse([30, 40, 30, 40, 30, 120])
      triggerShake(true)
      checkpointTimerRef.current = setTimeout(() => setCheckpointBeat(null), CHECKPOINT_400_MS)
    } else if (snapshot.state.floor >= 300) {
      duckBgm(CHECKPOINT_DUCK_MS, 1)
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

  /**
   * Ver.6 Phase 2: 490%（あと1問正解すれば500%）到達時の「最終問題への予告」演出。
   * floorではなくpercentを見る理由: 300/400はfloor（確保済みチェックポイント）だが、
   * 490はチェックポイントではなく「現在の到達％」そのものが対象のため（tier3は
   * 1 MISSで即終了・床へ戻るため、490はフロアとしては確保されない一時的な通過点）。
   * 実プレイでは490→500 CLEARへ直行する構造上、percentが490になるのは一度きり。
   * QAジャンプで490へ繰り返し移動した場合は、チェックポイント演出と同じ方針で
   * その都度再発火する（意図的な挙動）。
   */
  useEffect(() => {
    if (snapshot.state.percent === 490) {
      duckBgm(FINAL_QUESTION_DUCK_MS, 1)
      setShowFinalQuestionBeat(true)
      sfx.challenge500FinalQuestion490()
      hapticPulse([15, 50, 15, 50, 15, 120])
      triggerShake(true)
      finalQuestionTimerRef.current = setTimeout(() => setShowFinalQuestionBeat(false), FINAL_QUESTION_490_MS)
    }
    return () => {
      if (finalQuestionTimerRef.current) clearTimeout(finalQuestionTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.state.percent])

  useEffect(() => {
    if (!finalState) return
    hapticPulse(finalState.cleared ? [40, 60, 40, 60, 40, 60, 150] : 50)
    if (!finalState.cleared) {
      // チャレンジ終了（MISS）：常駐ハートビートはここで止め、結果画面まで持ち越さない。
      setChallenge500Mode(false)
      stopBgm()
      finishTimerRef.current = setTimeout(() => onFinish(finalState), END_FLASH_MS)
      return () => {
        if (finishTimerRef.current) clearTimeout(finishTimerRef.current)
      }
    }
    // 500%完全クリア：100% OVERDRIVEより明確に格上の「静寂→爆発」にする。
    // 常駐アンビエントを含む全バスを一度完全に沈黙させ（duckAudio）、沈黙が明けた瞬間に
    // OVERDRIVE級の爆発（第1波→暗転→第2波）を鳴らす（FinalTrialScreen側の
    // 200% CLEAR＝duckAudio→setTimeoutでmegaImpact、と同じ「静寂も演出として使う」考え方）。
    duckAudio(CLEAR500_SILENCE_MS, 1)
    setChallenge500Mode(false)
    stopBgm()
    clearTimersRef.current.push(
      setTimeout(() => {
        sfx.challenge500Clear500()
        setClearBeat('first')
        triggerShake(true)
      }, CLEAR500_SILENCE_MS),
      setTimeout(() => setClearBeat('blackout'), CLEAR500_SILENCE_MS + CLEAR_FIRST_BEAT_MS),
      setTimeout(
        () => {
          setClearBeat('second')
          triggerShake(true)
        },
        CLEAR500_SILENCE_MS + CLEAR_FIRST_BEAT_MS + CLEAR_BLACKOUT_MS,
      ),
      setTimeout(() => onFinish(finalState), CLEAR500_SILENCE_MS + CLEAR_FLASH_MS),
    )
    return () => {
      clearTimersRef.current.forEach(clearTimeout)
      clearTimersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalState])

  const CurrentQuestion = snapshot.currentSpec ? CHALLENGE500_QUESTION_MODULES.find((m) => m.id === snapshot.currentSpec!.type)?.Component : null
  const showingQuestion = !finalState && !checkpointBeat && !showFinalQuestionBeat && CurrentQuestion && snapshot.currentSpec

  /**
   * DOPA%表示そのものも帯域ごとに「人格」を変える（色は演出の補助であり、問題の
   * 正誤判定には一切関係しないため色覚アクセシビリティ方針に反しない）。
   * dangerテーマ（400〜480%）だけ、常時「1 MISS = END」を小さく表示する
   * （色を見分けられなくても危険領域であることが文字で伝わるようにする）。
   * ゲーム終了後（finalState確定後、500%クリア含む）はtierの危険表示を引きずらない
   * よう、常にニュートラルな色へ戻す（クリア後に赤い「1 MISS = END」が残ると
   * 紛らわしいため）。
   */
  const isGameOver = finalState !== null
  const dopaColorClass = isGameOver
    ? 'text-amber-300'
    : theme.id === 'overload'
      ? 'text-cyan-300'
      : theme.id === 'danger'
        ? 'text-red-400'
        : theme.id === 'finalQuestion'
          ? 'text-white/80'
          : 'text-amber-300'

  return (
    <div ref={shakeWrapperRef} className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      {!isGameOver && <Challenge500AmbientFX theme={theme} />}
      <QuitButton onQuit={onQuit} />

      <div className="relative z-30 flex items-start justify-between px-5 pt-3 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-white/40">限界突破チャレンジ</p>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">DOPA</p>
          <p ref={dopaTextRef} className={`text-4xl font-black tabular-nums ${dopaColorClass}`}>
            {snapshot.state.percent}
            <span className="text-xl">%</span>
          </p>
          {!isGameOver && theme.id === 'danger' && <p className="text-[9px] font-black tracking-widest text-red-400/90">1 MISS = END</p>}
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
            <Challenge500TimerBar
              limitMs={CHALLENGE500_CONFIG.questionTimeLimitMs}
              tier={tier}
              onTimeout={() => guardedHandleResult({ correct: false })}
            />
            <div className="flex-1">
              <CurrentQuestion spec={snapshot.currentSpec!} onResult={guardedHandleResult} />
            </div>
          </div>
        )}

        {checkpointBeat && <CheckpointOverlay beat={checkpointBeat} />}

        {showFinalQuestionBeat && <FinalQuestion490Overlay />}

        {finalState && (
          <Clear500Overlay beat={clearBeat} finalState={finalState} />
        )}
      </div>

      <Challenge500CorrectFx ref={correctFxRef} />

      {showQaPanel && !finalState && !checkpointBeat && !showFinalQuestionBeat && (
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
 * Ver.6 Phase 3（演出全面再構築）: 300%/400%チェックポイント演出。
 *
 * 以前はWhiteFlashOverlay＋RainbowShockwaveOverlay＋GoldenClearOverlay＋
 * Confetti120Overlay＋Sparkle120Overlayという「500% CLEARと同じ部品の量違い」で
 * 作っていたが、今回それをやめた。confetti/rainbow/golden burstは500% ABSOLUTE CLEAR
 * 専用に予約し、ここでは使わない——途中の到達点と最終到達点を同じ種類のエフェクトの
 * 量違いにしないため。
 *
 * 代わりに、WhiteFlashOverlay（中立な一瞬の白閃光、どのテーマでも使って良い汎用の
 * 「切り替わり」演出として再利用）＋テーマカラー（300=OVERLOAD/電気的な水色、
 * 400=DANGER ZONE/警告の赤）で染めた一撃ビネット＋プレーンな文字表示だけで構成する。
 * 400は300よりビネットの色が赤く強く、保持時間も長く（呼び出し元の
 * CHECKPOINT_400_MS > CHECKPOINT_300_MS）、画面シェイクも強い（triggerShake(true)）。
 * 色だけに依存しないよう、情報は文字そのものでも伝える。
 */
function CheckpointOverlay({ beat }: { beat: 'flash300' | 'flash400' }) {
  const is400 = beat === 'flash400'
  const percent = is400 ? 400 : 300
  const title = is400 ? 'DANGER ZONE' : 'OVERLOAD'
  const hint = is400 ? 'ここから1 MISSで終了。あと100%——' : '下線反転、最大2箇所——'
  const colorRgb = is400 ? '239, 68, 68' : '56, 214, 255'
  return (
    <>
      <WhiteFlashOverlay show />
      <div
        className="anim-challenge500-vignette pointer-events-none absolute inset-0 z-50"
        style={{ background: `radial-gradient(ellipse at center, rgba(${colorRgb}, 0) 40%, rgba(${colorRgb}, 0.6) 100%)` }}
      />
      <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-1 bg-black/70">
        <p
          className="anim-pop relative text-5xl font-black tabular-nums leading-none"
          style={{ color: `rgb(${colorRgb})`, textShadow: `0 0 30px rgba(${colorRgb}, 0.9)` }}
        >
          {percent}
          <span className="text-2xl">%</span>
        </p>
        <p className="anim-pop relative mt-2 text-xl font-black tracking-widest" style={{ color: `rgb(${colorRgb})` }}>
          {title}
        </p>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-12 z-[53] px-6 text-center text-xs font-bold text-white/70">{hint}</p>
    </>
  )
}

/**
 * Ver.6 Phase 2: 490%（あと1問正解すれば500%）専用の「最終問題への予告」演出。
 * 300/400チェックポイントや500 CLEARの黄金爆発・虹・紙吹雪・sparkleは一切使わない
 * （祝祭的な派手さではなく、警告・緊張感を前面に出すため）。代わりに、101%突破の
 * LimitErrorOverlay（components/OverdriveFx.tsx）と同じ「黒背景＋amber glitch＋
 * 警告色の文字」という既存の緊張感トーンを再利用する。長い説明文は出さない。
 */
function FinalQuestion490Overlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/85">
      <div className="anim-glitch absolute inset-0 bg-amber-400" />
      <p className="anim-pop relative text-3xl font-black tracking-[0.15em] text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.8)]">
        FINAL QUESTION
      </p>
      <p className="anim-pop relative text-xl font-black tracking-widest text-white/90">あと1問</p>
    </div>
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
