import { useEffect, useRef } from 'react'
import { QuitButton } from '../components/QuitButton'
import { ENDLESS_DIFFICULTY_LABEL, getEndlessBgmStageIndex, getEndlessPhase } from '../config/endlessConfig'
import { useEndlessGame, type EndlessFinishPayload } from '../engine/useEndlessGame'
import { QUESTION_MODULES } from '../questions'
import { setBgmProgress, startBgm, stopBgm } from '../utils/bgm'
import type { EndlessDifficulty, QuestionResult } from '../types'

interface Props {
  difficulty: EndlessDifficulty
  onFinish: (payload: EndlessFinishPayload) => void
  onQuit: () => void
  /** Preview/QA専用（既定false）。本番のApp.tsx通常プレイ経路からは絶対にtrueを渡さない。 */
  qaMode?: boolean
}

/** 正解時の軽い一撃（500%チャレンジのような大規模演出はコピーしない、控えめな手応えだけ）。 */
const CORRECT_SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: 'translate(0, 0)', offset: 0 },
  { transform: 'translate(-4px, 2px)', offset: 0.25 },
  { transform: 'translate(3px, -2px)', offset: 0.5 },
  { transform: 'translate(-2px, 1px)', offset: 0.75 },
  { transform: 'translate(0, 0)', offset: 1 },
]
const STREAK_POP_KEYFRAMES: Keyframe[] = [
  { transform: 'scale(1)', offset: 0 },
  { transform: 'scale(1.18)', offset: 0.4 },
  { transform: 'scale(1)', offset: 1 },
]

/**
 * Ver.6 Phase 4: Endlessの実プレイ画面。
 *
 * テーマ：アーケード・集中・連続記録・「あと1問いける」。500%チャレンジのような
 * 大規模な常時演出（AmbientFX・tierごとの色の人格等）はコピーしない——Endlessは
 * 「無限に続く軽快な連打」が主役であり、画面はシンプルに保つ。
 *
 * 問題そのもの（QUESTION_MODULES[type].Component）は通常0〜100%ゲームと完全に同じ
 * コンポーネントをそのまま描画する（Endless専用の問題コンポーネントは存在しない）。
 * 制限時間の自己MISS化は各問題コンポーネント内部で既に実装済み（spec.targetTimeMsの
 * setTimeout）のため、この画面側で別のタイマーロジックを持つ必要はない——下の
 * 進捗バーは「制限時間が分かる」ための表示専用（CSS transitionのみ、JS側の
 * rAFループは持たない）。
 */
export function EndlessPlayScreen({ difficulty, onFinish, onQuit, qaMode = false }: Props) {
  const { snapshot, start, handleResult } = useEndlessGame(difficulty, onFinish, { qaMode })
  const startedRef = useRef(false)
  const shakeWrapperRef = useRef<HTMLDivElement>(null)
  const shakeAnimRef = useRef<Animation | null>(null)
  const streakTextRef = useRef<HTMLParagraphElement>(null)
  const timerBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // BGM（utils/bgm.ts）は既存の通常ゲーム用アンビエント（startBgm/setBgmProgress）を
  // そのまま再利用する。固定した難易度のstageIndexと、streakが伸びるほど密度が増す
  // comboCount引数に、連続正解数（streak）をそのまま渡す。
  useEffect(() => {
    startBgm()
    return () => stopBgm()
  }, [])
  useEffect(() => {
    setBgmProgress(getEndlessBgmStageIndex(difficulty), snapshot.state.streak)
  }, [difficulty, snapshot.state.streak])

  // 問題が切り替わるたびに、制限時間ぶんかけて0%まで縮む進捗バーを再生する
  // （CSS transitionのみ。問題コンポーネント自身のtimeoutロジックとは独立した表示専用）。
  useEffect(() => {
    const el = timerBarRef.current
    if (!el || !snapshot.currentSpec) return
    el.style.transitionDuration = '0ms'
    el.style.width = '100%'
    const raf = requestAnimationFrame(() => {
      el.style.transitionDuration = `${snapshot.currentSpec!.targetTimeMs}ms`
      el.style.width = '0%'
    })
    return () => cancelAnimationFrame(raf)
  }, [snapshot.currentSpec])

  function guardedHandleResult(result: QuestionResult) {
    if (result.correct) {
      const el = shakeWrapperRef.current
      if (el) {
        shakeAnimRef.current?.cancel()
        shakeAnimRef.current = el.animate(CORRECT_SHAKE_KEYFRAMES, { duration: 160, easing: 'ease-in-out' })
      }
      const textEl = streakTextRef.current
      if (textEl) {
        textEl.getAnimations().forEach((anim) => anim.cancel())
        textEl.animate(STREAK_POP_KEYFRAMES, { duration: 300, easing: 'ease-out' })
      }
    }
    handleResult(result)
  }

  const CurrentQuestion = snapshot.currentSpec ? QUESTION_MODULES[snapshot.currentSpec.type].Component : null
  const visualLevel = getEndlessPhase(difficulty).visualLevel

  return (
    <div ref={shakeWrapperRef} className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />

      <div className="relative z-10 flex items-start justify-between px-5 pt-3 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-white/40">
          ENDLESS ・ {ENDLESS_DIFFICULTY_LABEL[difficulty]}
        </p>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">STREAK</p>
          <p ref={streakTextRef} className="text-4xl font-black tabular-nums text-fuchsia-300">
            {snapshot.state.streak}
          </p>
        </div>
      </div>

      <div className="relative z-10 h-1 w-full overflow-hidden bg-white/10">
        <div ref={timerBarRef} className="h-full bg-fuchsia-400/80" style={{ width: '0%', transitionTimingFunction: 'linear' }} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {CurrentQuestion && snapshot.currentSpec && (
          <div key={snapshot.currentSpec.instanceId} className="flex h-full w-full flex-col">
            <CurrentQuestion spec={snapshot.currentSpec} visualLevel={visualLevel} onResult={guardedHandleResult} />
          </div>
        )}

        {snapshot.milestoneLabel && (
          <p
            key={snapshot.milestoneKey}
            className="anim-popup-float pointer-events-none absolute bottom-24 text-2xl font-black tracking-widest text-fuchsia-300 drop-shadow-[0_0_16px_rgba(217,70,239,0.8)]"
          >
            {snapshot.milestoneLabel}
          </p>
        )}
      </div>
    </div>
  )
}
