import { useEffect, useRef } from 'react'
import { Challenge500TimerBar } from '../components/Challenge500TimerBar'
import { QuitButton } from '../components/QuitButton'
import { CHALLENGE500_CONFIG } from '../config/challenge500Config'
import { ENDLESS_BEGINNER_BGM_STAGE_INDEX, ENDLESS_BEGINNER_PHASE, ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { useEndlessGame, type EndlessFinishPayload, type EndlessQuestionOutcome } from '../engine/useEndlessGame'
import { CHALLENGE500_QUESTION_MODULES } from '../questions/challenge500'
import { QUESTION_MODULES } from '../questions'
import { FINAL_QUESTION_MODULES } from '../questions/final'
import { setBgmProgress, setFinalIntensity, setFinalMode, startBgm, stopBgm } from '../utils/bgm'
import type { EndlessDifficulty } from '../types'

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

/** 中級/上級（FINAL DOPA TRIAL相当の空気感）のBGM強度（0〜3）。streakが伸びるほど段階的にレイヤーを増やす。 */
function finalBgmIntensity(streak: number): number {
  return Math.min(3, Math.floor(streak / 8))
}

/**
 * Ver.6 Phase 4.2（難易度再々設計）: Endlessの実プレイ画面。
 *
 * テーマ：アーケード・集中・連続記録・「あと1問いける」。500%チャレンジのような
 * 大規模な常時演出（AmbientFX等）はコピーしない——Endlessは「無限に続く軽快な連打」が
 * 主役であり、画面はシンプルに保つ。難易度ごとのアクセントカラー（config/endlessTheme.ts）
 * は維持する。
 *
 * 問題そのものは、初級=QUESTION_MODULES（通常0〜120%相当の合成プール）、
 * 中級=FINAL_QUESTION_MODULES（FINAL DOPA TRIALと完全に同じコンポーネント）、
 * 上級=その両方＋CHALLENGE500_QUESTION_MODULES（200〜500% LIMIT BREAKと完全に同じ
 * コンポーネント＋下線反転）をそのまま描画する（Endless専用の問題コンポーネントは
 * 一切存在しない）。
 *
 * タイムアウトの扱いが出題元ごとに異なる点に注意（既存の設計差をそのまま踏襲）：
 * - normal/final：各問題コンポーネント自身がspec.targetTimeMsでタイムアウトを自己管理する
 *   （setTimeoutベース）。この画面の進捗バーはCSS transitionのみの表示専用。
 * - challenge500：Challenge500QuestionSpecにtargetTimeMsという概念がなく、本家
 *   Challenge500Screen.tsxと同じく画面側が外付けのChallenge500TimerBar（内部でrAF計測・
 *   焦り警告音を管理）をキーごと並置してタイムアウトを管理する。本家が採用している
 *   「進捗バーの可視表示なし（テンポ音のみで時間を伝える）」という設計判断もそのまま
 *   踏襲し、challenge500問題の間だけこの画面の視覚タイマーバーを非表示にする
 *   （新しい表示ルールを作らず、2系統の既存の違いをそのまま反映しただけ）。
 */
export function EndlessPlayScreen({ difficulty, onFinish, onQuit, qaMode = false }: Props) {
  const { snapshot, start, handleResult } = useEndlessGame(difficulty, onFinish, { qaMode })
  const startedRef = useRef(false)
  const shakeWrapperRef = useRef<HTMLDivElement>(null)
  const shakeAnimRef = useRef<Animation | null>(null)
  const streakTextRef = useRef<HTMLParagraphElement>(null)
  const timerBarRef = useRef<HTMLDivElement>(null)
  const theme = ENDLESS_THEME[difficulty]

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // BGM（utils/bgm.ts）は難易度ごとに別の既存アンビエントをそのまま再利用する。
  // 初級＝通常ゲームの6段階エンジン（0〜120%全体を代表する固定stageIndex＋streakで密度アップ）、
  // 中級/上級＝FINAL DOPA TRIAL専用BGMモード（ハートビート・金属パーカッション・不穏パッド）を
  // そのまま流用し、「本物のFINAL DOPA TRIALと同じ空気感」にする。上級はChallenge500問題も
  // 混在するが、Challenge500専用アンビエント（setChallenge500Mode）までは持ち込まず、
  // 難易度単位の既存の音テーマ割り当て（維持指示どおり）をそのまま使う。新しい音色は作らない。
  useEffect(() => {
    startBgm()
    if (difficulty !== 'beginner') setFinalMode(true)
    return () => stopBgm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty])
  useEffect(() => {
    if (difficulty === 'beginner') {
      setBgmProgress(ENDLESS_BEGINNER_BGM_STAGE_INDEX, snapshot.state.streak)
      return
    }
    setFinalIntensity(finalBgmIntensity(snapshot.state.streak))
  }, [difficulty, snapshot.state.streak])

  // 問題が切り替わるたびに、制限時間ぶんかけて0%まで縮む進捗バーを再生する
  // （CSS transitionのみ。問題コンポーネント自身のtimeoutロジックとは独立した表示専用）。
  // challenge500問題にはtargetTimeMsという概念がない（本家Challenge500Screenと同じく
  // 視覚タイマーバー非表示）ため、このeffect自体をスキップする。
  useEffect(() => {
    const el = timerBarRef.current
    const slot = snapshot.currentSlot
    if (!el || !slot || slot.kind === 'challenge500') return
    el.style.transitionDuration = '0ms'
    el.style.width = '100%'
    const raf = requestAnimationFrame(() => {
      el.style.transitionDuration = `${slot.spec.targetTimeMs}ms`
      el.style.width = '0%'
    })
    return () => cancelAnimationFrame(raf)
  }, [snapshot.currentSlot])

  function guardedHandleResult(result: EndlessQuestionOutcome) {
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

  const slot = snapshot.currentSlot

  return (
    <div ref={shakeWrapperRef} className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />

      <div className="relative z-10 flex items-start justify-between px-5 pt-3 pb-1">
        <p className={`text-[10px] font-bold tracking-widest ${theme.textClass}`}>
          ENDLESS ・ {ENDLESS_DIFFICULTY_LABEL[difficulty]} ・ {theme.mood}
        </p>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">STREAK</p>
          <p ref={streakTextRef} className={`text-4xl font-black tabular-nums ${theme.textClass} ${theme.glowClass}`}>
            {snapshot.state.streak}
          </p>
        </div>
      </div>

      {slot?.kind !== 'challenge500' && (
        <div className="relative z-10 h-1 w-full overflow-hidden bg-white/10">
          <div
            ref={timerBarRef}
            className={`h-full ${theme.timerBarClass}`}
            style={{ width: '0%', transitionTimingFunction: 'linear' }}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {slot?.kind === 'normal' &&
          (() => {
            const NormalQuestion = QUESTION_MODULES[slot.spec.type].Component
            return (
              <div key={slot.spec.instanceId} className="flex h-full w-full flex-col">
                <NormalQuestion spec={slot.spec} visualLevel={ENDLESS_BEGINNER_PHASE.visualLevel} onResult={guardedHandleResult} />
              </div>
            )
          })()}
        {slot?.kind === 'final' &&
          (() => {
            const FinalQuestion = FINAL_QUESTION_MODULES[slot.spec.type].Component
            return (
              <div key={slot.spec.instanceId} className="flex h-full w-full flex-col">
                <FinalQuestion spec={slot.spec} onResult={guardedHandleResult} />
              </div>
            )
          })()}
        {slot?.kind === 'challenge500' &&
          (() => {
            const Challenge500Question = CHALLENGE500_QUESTION_MODULES.find((m) => m.id === slot.spec.type)!.Component
            return (
              <div key={slot.spec.instanceId} className="flex h-full w-full flex-col">
                <Challenge500TimerBar
                  limitMs={CHALLENGE500_CONFIG.questionTimeLimitMs}
                  tier={slot.tier}
                  onTimeout={() => guardedHandleResult({ correct: false })}
                />
                <Challenge500Question spec={slot.spec} onResult={guardedHandleResult} />
              </div>
            )
          })()}

        {snapshot.milestoneLabel && (
          <p
            key={snapshot.milestoneKey}
            className={`anim-popup-float pointer-events-none absolute bottom-24 text-2xl font-black tracking-widest ${theme.textClass} ${theme.glowClass}`}
          >
            {snapshot.milestoneLabel}
          </p>
        )}
      </div>
    </div>
  )
}
