import { useEffect, useRef, useState } from 'react'
import { Challenge500TimerBar } from '../components/Challenge500TimerBar'
import { QuitButton } from '../components/QuitButton'
import { CHALLENGE500_CONFIG } from '../config/challenge500Config'
import { ENDLESS_BEGINNER_BGM_STAGE_INDEX, ENDLESS_BEGINNER_PHASE, ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { usePreCountdown } from '../engine/usePreCountdown'
import { shouldShowEndlessTimerBar, useEndlessGame, type EndlessFinishPayload, type EndlessQuestionOutcome } from '../engine/useEndlessGame'
import { CHALLENGE500_QUESTION_MODULES } from '../questions/challenge500'
import { QUESTION_MODULES } from '../questions'
import { FINAL_QUESTION_MODULES } from '../questions/final'
import { EndlessAdvancedRuleCard } from './EndlessAdvancedRuleCard'
import { setBgmProgress, setFinalIntensity, setFinalMode, startBgm, stopBgm } from '../utils/bgm'
import type { ChallengeProblemSetItem } from '../challenge/types'
import type { EndlessDifficulty } from '../types'

interface Props {
  difficulty: EndlessDifficulty
  onFinish: (payload: EndlessFinishPayload) => void
  onQuit: () => void
  /** Preview/QA専用（既定false）。本番のApp.tsx通常プレイ経路からは絶対にtrueを渡さない。 */
  qaMode?: boolean
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: 指定時、挑戦者はホストと完全に同じ問題・同じ順番で
   * 再生する（useEndlessGameへそのまま渡す）。
   */
  replayQuestions?: ChallengeProblemSetItem[]
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: 指定時、画面上部に「STREAK N / TARGET M」を常時表示し、
   * TARGETに近づくと軽い演出（あと5/あと3/あと1）を出す。超えた瞬間に即WIN終了する
   * （useEndlessGameのtargetStreakへそのまま渡す）。
   */
  targetStreak?: number
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
 * タイムアウトの扱い・視覚バー表示は出題元ごとに異なる（既存の設計差をそのまま踏襲）：
 * - normal（初級）：各問題コンポーネント自身がspec.targetTimeMsでタイムアウトを
 *   自己管理する（単純なsetTimeoutベース、問題マウント直後からtimeoutまで一定速度で
 *   経過する）。そのためEndlessの進捗バー（CSS transitionのみの表示専用）をそのまま
 *   表示してよい。
 * - final（中級/上級）：FINAL DOPA TRIAL本体と全く同じコンポーネントをそのまま描画する。
 *   実機QAで発覚した不整合：記憶問題（FinalMemoryPickQuestion等）はspec.targetTimeMsが
 *   「回答フェーズだけ」の時間を表し、実際のMISSタイマーは記憶表示フェーズ
 *   （TIMING_SAFETY.final.memoryRevealMs）が終わった後に初めて開始される。Endlessの
 *   進捗バーは問題マウント直後からspec.targetTimeMsで一定速度に減っていくだけなので、
 *   記憶表示中にバーだけ先に0%へ到達し、実際のOUTタイミングとズレて見えた。
 *   FINAL系の問題は「本家FINAL DOPA TRIALの画面でも視覚タイマーバーは表示していない
 *   （問題コンポーネント自身の演出・UIだけで時間を伝える）」ため、Endlessでも同じく
 *   final問題の間はこの画面の視覚タイマーバーを表示しない（時間管理そのものは一切
 *   変更せず、「Endless側の重複したタイマーUIを消す」だけの修正）。
 * - challenge500（上級）：Challenge500QuestionSpecにtargetTimeMsという概念がなく、本家
 *   Challenge500Screen.tsxと同じく画面側が外付けのChallenge500TimerBar（内部でrAF計測・
 *   焦り警告音を管理）をキーごと並置してタイムアウトを管理する。本家が採用している
 *   「進捗バーの可視表示なし（テンポ音のみで時間を伝える）」という設計判断もそのまま
 *   踏襲し、challenge500問題の間もこの画面の視覚タイマーバーを表示しない。
 *
 * まとめると、Endless共通の視覚タイマーバーを表示するのは normal（初級）の間だけ。
 * final/challenge500は、それぞれの出題元（本家FINAL DOPA TRIAL／本家Challenge500）が
 * 元々採用している時間表現（問題内部の演出・焦り音のみ、可視バーなし）にそのまま委ねる。
 */
type Phase = 'rule' | 'countdown' | 'playing'

export function EndlessPlayScreen({ difficulty, onFinish, onQuit, qaMode = false, replayQuestions, targetStreak }: Props) {
  const { snapshot, start, handleResult } = useEndlessGame(difficulty, onFinish, { qaMode, replayQuestions, targetStreak })
  // item 5/7（実機QA最終改善）: 上級だけ開始前にルール説明を挟む。その後（または
  // 他難易度は最初から）、通常モードと同じ3→2→1→STARTを見せてからplayingへ入る。
  // phaseが'playing'になるまでstart()を呼ばないため、「カウントダウン中は問題の
  // タイマーが進まない」が構造的に保証される。
  const [phase, setPhase] = useState<Phase>(difficulty === 'advanced' ? 'rule' : 'countdown')
  const startedRef = useRef(false)
  const shakeWrapperRef = useRef<HTMLDivElement>(null)
  const shakeAnimRef = useRef<Animation | null>(null)
  const streakTextRef = useRef<HTMLParagraphElement>(null)
  const timerBarRef = useRef<HTMLDivElement>(null)
  const theme = ENDLESS_THEME[difficulty]

  const countdownValue = usePreCountdown({
    enabled: phase === 'countdown',
    onDone: () => {
      if (startedRef.current) return
      startedRef.current = true
      start()
      setPhase('playing')
    },
  })

  // BGM（utils/bgm.ts）は難易度ごとに別の既存アンビエントをそのまま再利用する。
  // 初級＝通常ゲームの6段階エンジン（0〜120%全体を代表する固定stageIndex＋streakで密度アップ）、
  // 中級/上級＝FINAL DOPA TRIAL専用BGMモード（ハートビート・金属パーカッション・不穏パッド）を
  // そのまま流用し、「本物のFINAL DOPA TRIALと同じ空気感」にする。上級はChallenge500問題も
  // 混在するが、Challenge500専用アンビエント（setChallenge500Mode）までは持ち込まず、
  // 難易度単位の既存の音テーマ割り当て（維持指示どおり）をそのまま使う。新しい音色は作らない。
  // 通常モード（useRushGame）がGOの瞬間にBGMを開始するのと同じく、Endlessもplayingに
  // 入った瞬間（カウントダウン完了後）に初めて開始する——ルール説明/カウントダウン中は鳴らさない。
  useEffect(() => {
    if (phase !== 'playing') return
    startBgm()
    if (difficulty !== 'beginner') setFinalMode(true)
    return () => stopBgm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, phase])
  useEffect(() => {
    if (difficulty === 'beginner') {
      setBgmProgress(ENDLESS_BEGINNER_BGM_STAGE_INDEX, snapshot.state.streak)
      return
    }
    setFinalIntensity(finalBgmIntensity(snapshot.state.streak))
  }, [difficulty, snapshot.state.streak])

  // 問題が切り替わるたびに、制限時間ぶんかけて0%まで縮む進捗バーを再生する
  // （CSS transitionのみ。問題コンポーネント自身のtimeoutロジックとは独立した表示専用）。
  // 視覚バーを表示するのはnormal（初級）だけ（final/challenge500は本家と同じく
  // バーなし——上のコンポーネント先頭コメント参照）なので、final/challenge500では
  // このeffect自体をスキップする。
  useEffect(() => {
    const el = timerBarRef.current
    const slot = snapshot.currentSlot
    // shouldShowEndlessTimerBar(slot.kind)と同じ判定だが、ここではspec.targetTimeMsへの
    // アクセスのためにTypeScriptの判別共用体の絞り込みが必要なため、kindのリテラル比較を
    // 直接書く（JSX側の表示可否はshouldShowEndlessTimerBarを単一の判断基準として使う）。
    if (!el || !slot || slot.kind !== 'normal') return
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

  if (phase === 'rule') {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-black">
        <QuitButton onQuit={onQuit} />
        <EndlessAdvancedRuleCard onContinue={() => setPhase('countdown')} />
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-6 text-center">
        <QuitButton onQuit={onQuit} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className={`text-xs font-black tracking-[0.3em] ${theme.textClass}`}>
            ENDLESS ・ {ENDLESS_DIFFICULTY_LABEL[difficulty]}
          </p>
          <p key={countdownValue ?? 'go'} className={`anim-pop text-8xl font-black text-white ${theme.glowClass}`}>
            {countdownValue ?? 'GO'}
          </p>
        </div>
      </div>
    )
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
          <p className="text-[10px] font-bold tracking-widest text-white/50">
            {targetStreak === undefined ? 'STREAK' : 'STREAK / TARGET'}
          </p>
          <p ref={streakTextRef} className={`text-4xl font-black tabular-nums ${theme.textClass} ${theme.glowClass}`}>
            {snapshot.state.streak}
            {targetStreak !== undefined && <span className="text-xl text-white/30"> / {targetStreak}</span>}
          </p>
          {/* Ver.6 Phase 8（ENDLESS Challenge）: item 16/17。TARGETが近づいたときだけ軽く表示する
              非ブロッキングな演出（テンポを止める一時停止・モーダルは出さない）。 */}
          {targetStreak !== undefined &&
            (() => {
              const remainingToWin = targetStreak + 1 - snapshot.state.streak
              if (remainingToWin === 2) return <p className="text-[10px] font-black text-white/50">DRAW LINE</p>
              if (remainingToWin === 1) return <p className="text-[10px] font-black text-amber-300">WIN QUESTION</p>
              if (remainingToWin === 5 || remainingToWin === 3) return <p className="text-[10px] font-black text-amber-200/80">あと{remainingToWin}</p>
              return null
            })()}
        </div>
      </div>

      {slot && shouldShowEndlessTimerBar(slot.kind) && (
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
