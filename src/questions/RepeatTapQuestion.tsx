import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { judgeByRatio } from '../config/scoreConfigV4'
import { randInt } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

/**
 * Ver.4.8: 「INPUT → CONFIRM_STOP → RESOLVED」の明示的な状態機械に再構成。
 *
 * 実機で報告され続けていた「3回正しく押して止まっているのにMISSになる」の根本原因は、
 * Ver.4.6で入れたタイマー再武装（止まれの合図が出た瞬間、外側タイマーをstopConfirmMs
 * 基準に引き直す）のレースではなかった――そちらは構造的に正しく、SUCCESS用のholdTimerは
 * 常にMISS用のfailTimerより先に発火する。
 *
 * 本当の原因は、この問題が唯一「高速連打」を要求するお題であるにもかかわらず、
 * handleTapが生のpointerdownを一切重複排除していなかったこと。静電容量タッチパネルは
 * 高速連打中、1回の物理タップを2回のpointerdownとして誤検知する（コンタクトバウンス）
 * ことがある。これが起きると、プレイヤーがまだ規定回数に達していないと思っている間に
 * 内部カウントだけが1回多く進み、CONFIRM_STOPへ切り替わってしまう。その直後にプレイヤーが
 * 打つ「本人にとっては正しい最後の1回」がCONFIRM_STOP中の「余計な1回」としてMISS判定される。
 * MIN_TAP_INTERVAL_MS未満の連続pointerdownをバウンスとして無視することでこれを構造的に防ぐ。
 */
const MIN_TAP_INTERVAL_MS = TIMING_SAFETY.repeatTap.minTapIntervalMs

function generate() {
  return { required: randInt(3, 7), stopConfirmMs: randInt(700, 900) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { required, stopConfirmMs } = data as { required: number; stopConfirmMs: number }
  return required * TIMING_SAFETY.repeatTap.perTapMs + TIMING_SAFETY.repeatTap.reactionBufferMs + stopConfirmMs + TIMING_SAFETY.repeatTap.stopSafetyMarginMs
}

/** カウント中か、規定回数に達して「止まれ」を確認中か。RESOLVED相当はguardRef側で管理する。 */
type Phase = 'INPUT' | 'CONFIRM_STOP'

function Component({ spec, onResult }: QuestionComponentProps) {
  const { required, stopConfirmMs } = spec.data as { required: number; stopConfirmMs: number }
  const [count, setCount] = useState(0)
  const [uiPhase, setUiPhase] = useState<Phase>('INPUT')
  const phaseRef = useRef<Phase>('INPUT')
  const countRef = useRef(0)
  const startRef = useRef(performance.now())
  const reachedAtRef = useRef<number | null>(null)
  const lastTapAtRef = useRef(0)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false, 0), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, extraTaps: number, reactionMsOverride?: number) {
    const guard = guardRef.current!
    if (guard.isResolved) return
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    const reactionMs = reactionMsOverride ?? performance.now() - startRef.current
    if (!correct) {
      guard.resolve({ correct: false, reactionMs, meta: extraTaps > 0 ? { extraTaps } : undefined })
      return
    }
    const ratioWindowMs = required * TIMING_SAFETY.repeatTap.perTapMs + TIMING_SAFETY.repeatTap.reactionBufferMs
    const tier = judgeByRatio(reactionMs, ratioWindowMs)
    guard.resolve({ correct: true, reactionMs, tierOverride: tier })
  }

  function handleTap() {
    if (guardRef.current!.isResolved) return
    const now = performance.now()
    // コンタクトバウンス対策：人間の連打限界より十分短い間隔の重複入力は無視する。
    if (now - lastTapAtRef.current < MIN_TAP_INTERVAL_MS) return
    lastTapAtRef.current = now

    if (phaseRef.current === 'CONFIRM_STOP') {
      // 停止確認中に押した＝止まれなかった
      finish(false, 1)
      return
    }

    const next = countRef.current + 1
    if (next > required) {
      // 指定回数を超えて押した瞬間MISS
      finish(false, next - required)
      return
    }
    countRef.current = next
    setCount(next)
    if (next === required) {
      reachedAtRef.current = now
      phaseRef.current = 'CONFIRM_STOP'
      setUiPhase('CONFIRM_STOP')
      // 規定回数に到達した瞬間、外側タイマーをstopConfirmMs+安全マージン基準に引き直す。
      // これにより「必要な停止確認を満たしたのにtimeoutが先に発火する」レースを構造的に防ぐ。
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      failTimerRef.current = setTimeout(
        () => finish(false, 1),
        stopConfirmMs + TIMING_SAFETY.repeatTap.stopSafetyMarginMs,
      )
      holdTimerRef.current = setTimeout(() => {
        finish(true, 0, (reachedAtRef.current ?? performance.now()) - startRef.current)
      }, stopConfirmMs)
    }
  }

  return (
    <QuestionShell
      sub={uiPhase === 'CONFIRM_STOP' ? '指を触れずに待て' : '規定回数で止まれ'}
      instruction={uiPhase === 'CONFIRM_STOP' ? '止まれ！' : `${required}回タップせよ！`}
    >
      <button
        onPointerDown={handleTap}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-white active:scale-95 ${
          uiPhase === 'CONFIRM_STOP' ? 'bg-gradient-to-b from-red-500 to-rose-600' : 'bg-gradient-to-b from-fuchsia-500 to-purple-600'
        }`}
      >
        {count}
      </button>
    </QuestionShell>
  )
}

export const RepeatTapQuestionModule: QuestionModule = {
  id: 'repeatTap',
  category: 'rapid',
  baseTargetTimeMs: 1800,
  generate,
  Component,
  computeMinTargetTimeMs,
}
