import { useEffect, useRef, useState } from 'react'
import { Challenge500QaPanel } from '../dev/Challenge500QaPanel'
import { Challenge500TimerBar } from '../components/Challenge500TimerBar'
import { QuitButton } from '../components/QuitButton'
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
/** 500%完全クリアは「数秒程度しっかり見せても構わない」という指示のため、通常終了より長く見せる。 */
const CLEAR_FLASH_MS = 3400
const CHECKPOINT_300_MS = 1700
/** 400% CHECKPOINTは300%より明確に強く・長く見せる。 */
const CHECKPOINT_400_MS = 2200

function hapticPulse(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
}

type CheckpointBeat = 'flash300' | 'flash400' | null

/**
 * Ver.6 Phase 1（再設計版）: 200〜500%「限界突破チャレンジ」の実プレイ画面。
 * 300%/400%チェックポイント到達時に一度ゲームを止めて専用の節目演出を挟み、
 * 正解のたびに短い報酬演出（ポップ・バウンス・SE・haptic）を出す。派手さは
 * CSSアニメーションの使い回し（anim-pop等、既存の軽量なクラス）で実現し、
 * 大量のDOM生成を伴うパーティクル乱発は行わない（パフォーマンス配慮）。
 */
export function Challenge500Screen({ onFinish, onQuit, qaMode = false }: Props) {
  const [finalState, setFinalState] = useState<Challenge500State | null>(null)
  const { snapshot, start, handleResult, jumpTo } = useChallenge500((state) => setFinalState(state), { qaMode })
  const startedRef = useRef(false)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showQaPanel = qaMode && __DOPAGAKI_PREVIEW_ENABLED__

  const [checkpointBeat, setCheckpointBeat] = useState<CheckpointBeat>(null)
  const checkpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [correctPulseKey, setCorrectPulseKey] = useState(0)

  /**
   * タップでの正解/MISS判定（各問題コンポーネント自身のonPointerDown経由）と、
   * Challenge500TimerBarの時間切れ（onTimeout）は、どちらが先に解決するか分からない
   * 競合状態にある。resolvedRefで「この問題インスタンスについて、どちらか一方が
   * 既にhandleResultを呼んだか」を管理し、2回目以降の呼び出しは無視する
   * （例: 時間切れでMISS確定した直後に、表示上まだ残っていたタップが遅れて届いても
   * 二重にhandleResultが呼ばれない）。
   */
  const resolvedRef = useRef(false)
  useEffect(() => {
    resolvedRef.current = false
  }, [snapshot.currentSpec?.instanceId])

  function guardedHandleResult(result: Challenge500QuestionResult) {
    if (resolvedRef.current) return
    resolvedRef.current = true
    const tier = tierForPercent(snapshot.state.percent)
    if (result.correct) {
      sfx.challenge500Correct(tier)
      hapticPulse(15)
      setCorrectPulseKey((k) => k + 1)
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
      hapticPulse([30, 40, 30, 80])
      checkpointTimerRef.current = setTimeout(() => setCheckpointBeat(null), CHECKPOINT_400_MS)
    } else if (snapshot.state.floor >= 300) {
      setCheckpointBeat('flash300')
      sfx.challenge500Checkpoint300()
      hapticPulse([20, 30, 20])
      checkpointTimerRef.current = setTimeout(() => setCheckpointBeat(null), CHECKPOINT_300_MS)
    }
    return () => {
      if (checkpointTimerRef.current) clearTimeout(checkpointTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.state.floor])

  useEffect(() => {
    if (!finalState) return
    if (finalState.cleared) sfx.challenge500Clear500()
    hapticPulse(finalState.cleared ? [40, 60, 40, 60, 120] : 50)
    const delay = finalState.cleared ? CLEAR_FLASH_MS : END_FLASH_MS
    finishTimerRef.current = setTimeout(() => onFinish(finalState), delay)
    return () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalState])

  const CurrentQuestion = snapshot.currentSpec ? CHALLENGE500_QUESTION_MODULES.find((m) => m.id === snapshot.currentSpec!.type)?.Component : null
  const showingQuestion = !finalState && !checkpointBeat && CurrentQuestion && snapshot.currentSpec

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />

      <div className="relative z-10 flex items-start justify-between px-5 pt-3 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-white/40">限界突破チャレンジ</p>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">DOPA</p>
          <p key={correctPulseKey} className="anim-spike text-4xl font-black tabular-nums text-amber-300">
            {snapshot.state.percent}
            <span className="text-xl">%</span>
          </p>
        </div>
      </div>

      {snapshot.state.floor > CHALLENGE500_CONFIG.startPercent && !checkpointBeat && (
        <p className="relative z-10 text-center text-[11px] font-black text-emerald-300">
          CHECKPOINT {snapshot.state.floor}% 確保済み
        </p>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {showingQuestion && (
          <div key={snapshot.currentSpec!.instanceId} className="flex h-full w-full flex-col">
            <div className="flex justify-center px-8 pb-2">
              <Challenge500TimerBar
                limitMs={CHALLENGE500_CONFIG.questionTimeLimitMs}
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
          <div className="anim-pop flex flex-col items-center gap-3 text-center">
            {finalState.cleared ? (
              <>
                <p className="text-sm font-black tracking-widest text-amber-300">DOPA 500%</p>
                <p className="anim-pop text-5xl font-black text-white">ABSOLUTE CLEAR</p>
                <p className="anim-pop text-sm font-black tracking-widest text-white/60" style={{ animationDelay: '0.3s' }}>
                  LIMIT BREAK COMPLETE
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black tracking-widest text-white/50">CHALLENGE END</p>
                <p className="text-5xl font-black tabular-nums text-amber-300">{finalState.percent}%</p>
              </>
            )}
          </div>
        )}
      </div>

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
 * 300%/400%チェックポイント演出。400%は300%より明確に強く
 * （より大きな文字・追加の警告テキスト・次段階ルールの一言）見せる。
 * 色だけに依存しないよう、文字そのもので情報を伝える（CHECKPOINT SECURED等）。
 */
function CheckpointOverlay({ beat }: { beat: 'flash300' | 'flash400' }) {
  const is400 = beat === 'flash400'
  return (
    <div className="anim-pop flex flex-col items-center gap-3 text-center">
      <p className={`text-sm font-black tracking-widest ${is400 ? 'text-red-300' : 'text-emerald-300'}`}>
        {is400 ? 'FINAL CHECKPOINT' : 'CHECKPOINT SECURED'}
      </p>
      <p className="anim-pop text-6xl font-black text-white">{is400 ? '400%' : '300%'}</p>
      <p className="text-xs font-bold text-white/50">
        {is400 ? 'ここから1 MISSで終了。あと100%——' : '下線反転、最大2箇所——'}
      </p>
    </div>
  )
}
