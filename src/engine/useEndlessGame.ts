import { useRef, useState } from 'react'
import {
  ENDLESS_BEGINNER_PHASE,
  FINAL_POOL_TIERS,
  endlessMilestoneLevel,
  isEndlessMilestone,
} from '../config/endlessConfig'
import {
  CHALLENGE500_ENDLESS_TIERS,
  CHALLENGE500_TIER_REPRESENTATIVE_PERCENT,
  pickEndlessAdvancedOrigin,
  type EndlessAdvancedOrigin,
} from './endlessAdvancedPicker'
import { applyEndlessCorrect, applyEndlessMiss, createEndlessState, type EndlessState } from './endlessEngine'
import { pickFinalQuestion } from './finalQuestionPicker'
import { generateNextQuestion } from './questionPicker'
import { pick } from './random'
import { pickChallenge500Question } from '../questions/challenge500'
import { trackEndlessEnd, trackEndlessStart } from '../utils/analytics'
import { getEndlessBest, updateEndlessBest } from '../utils/storage'
import { sfx } from '../utils/sound'
import type { Challenge500QuestionSpec, Challenge500Tier } from '../questions/challenge500/types'
import type { EndlessDifficulty, FinalQuestionSpec, FinalQuestionTag, QuestionSpec, QuestionTypeId } from '../types'

/** 直近何問分のタイプを覚えておくか。useRushGame.ts／useFinalTrial.tsと同じ値・同じ目的（カテゴリ連続回避）。 */
const RECENT_TYPES_LENGTH = 3
/** 節目バナー（例: "10 STREAK"）の表示時間（ms）。useRushGameのcomboMilestoneLabelと同じ値。 */
const MILESTONE_BANNER_MS = 900

/**
 * Ver.6 Phase 4.2（難易度再々設計）: 初級は通常ゲームのQuestionModule、中級はFINAL DOPA
 * TRIALのFinalQuestionModule、上級はその両方に加えてChallenge500QuestionModule（200〜500%
 * LIMIT BREAKの既存11問題タイプ＋下線反転）も出題元になる。3つの問題コンポーネント体系は
 * それぞれ型・Component props（visualLevelの有無、targetTimeMsの有無）が異なるため、
 * 1問ぶんを「どの体系から来たか」ごとタグ付けして保持し、呼び出し元の画面
 * （EndlessPlayScreen）がkindで分岐して正しいComponent（＋Challenge500のみ別途必要な
 * 外付けタイマーChallenge500TimerBar）を解決する。問題生成ロジック自体は一切複製せず、
 * 既存のgenerateNextQuestion／pickFinalQuestion／pickChallenge500Questionをそのまま呼ぶ。
 */
export type EndlessQuestionSlot =
  | { kind: 'normal'; spec: QuestionSpec }
  | { kind: 'final'; spec: FinalQuestionSpec }
  | { kind: 'challenge500'; spec: Challenge500QuestionSpec; tier: Challenge500Tier }

/**
 * Ver.6 Phase 4.3（実機QA修正）: Endless共通の視覚タイマーバー（EndlessPlayScreen.tsx）を
 * 表示してよいのはnormal（初級）の間だけ。
 *
 * final（中級/上級のFINAL DOPA TRIAL由来）はspec.targetTimeMsが必ずしも「問題マウントから
 * 一定速度で減る」時間を表さない（例: FinalMemoryPickQuestionは記憶表示フェーズの後に
 * 初めて回答タイマーが開始する）ため、Endless側の単純な線形バーを重ねると実際のMISS
 * タイミングと視覚上ズレる。本家FINAL DOPA TRIALの画面自体も視覚タイマーバーを持たない
 * （問題コンポーネント自身の演出だけで時間を伝える）ため、Endlessでも同じ表現に揃える。
 *
 * challenge500（上級のChallenge500由来）はそもそもtargetTimeMsという概念がなく
 * （外付けのChallenge500TimerBarが管理）、本家Challenge500Screen.tsxも視覚タイマーバーを
 * 持たない（焦り音のテンポだけで時間を伝える）ため、同様に表示しない。
 *
 * 時間制限・タイムアウト判定そのものには一切関与しない、純粋な表示ルールだけの関数
 * （DOM・Reactに依存しないためvitestで直接検証できる）。
 */
export function shouldShowEndlessTimerBar(kind: EndlessQuestionSlot['kind']): kind is 'normal' {
  return kind === 'normal'
}

/** QuestionResult・FinalQuestionResult・Challenge500QuestionResultのいずれもが満たす最小限の結果形。 */
export interface EndlessQuestionOutcome {
  correct: boolean
}

export interface EndlessSnapshot {
  state: EndlessState
  currentSlot: EndlessQuestionSlot | null
  /** 節目（10/20/30/50...）到達時だけ短時間表示するバナー文言。テンポを止めない非ブロッキング表示。 */
  milestoneLabel: string | null
  milestoneKey: number
}

export interface EndlessFinishPayload {
  score: number
  isNewBest: boolean
  best: number
}

export interface UseEndlessGameOptions {
  /**
   * Preview/QA専用モード。trueの場合、GA4のendless_start/endless_end送信と
   * localStorageの自己ベスト更新を両方抑制する（既存のuseChallenge500.tsと同じ方針：
   * QA操作を実際のプレイ記録として残さない）。
   */
  qaMode?: boolean
}

/**
 * Ver.6 Phase 4: Endlessモード（「何問連続正解できるか」）の画面用エンジン。
 *
 * 通常ゲーム（useRushGame.ts）のDOPA%・COMBO倍率・MOMENTUM・OVERDRIVEも、Challenge500の
 * DOPA%・チェックポイント・tier別MISSペナルティも一切持たない——Endlessはスコア＝連続
 * 正解数だけのシンプルなモードのため、それらは不要かつ過剰（ユーザー指示：Challenge500の
 * 進行ルールはEndlessへ持ち込まない）。常に「1 MISS = END」のみ。
 *
 * BGM（startBgm/stopBgm/setBgmProgress/setFinalMode/setFinalIntensity）はこのhookではなく
 * 呼び出し元の画面（EndlessPlayScreen.tsx）が担当する——useChallenge500.tsと同じ責務分担
 * （hook＝ゲームロジック、画面＝音・演出の副作用）を踏襲した。
 */
export function useEndlessGame(
  difficulty: EndlessDifficulty,
  onFinish: (payload: EndlessFinishPayload) => void,
  options?: UseEndlessGameOptions,
) {
  const qaMode = options?.qaMode ?? false

  const [snapshot, setSnapshot] = useState<EndlessSnapshot>(() => ({
    state: createEndlessState(),
    currentSlot: null,
    milestoneLabel: null,
    milestoneKey: 0,
  }))

  const stateRef = useRef(createEndlessState())
  const recentTypesRef = useRef<QuestionTypeId[]>([])
  const recentFinalTypesRef = useRef<string[]>([])
  const recentFinalTagsRef = useRef<FinalQuestionTag[]>([])
  const recentChallenge500TypeRef = useRef<string | null>(null)
  const recentAdvancedOriginsRef = useRef<EndlessAdvancedOrigin[]>([])
  const startedRef = useRef(false)
  const milestoneKeyRef = useRef(0)
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function buildFinalSlot(): EndlessQuestionSlot {
    const tier = pick(FINAL_POOL_TIERS)
    const spec = pickFinalQuestion(tier, recentFinalTypesRef.current, recentFinalTagsRef.current)
    recentFinalTypesRef.current = [spec.type, ...recentFinalTypesRef.current].slice(0, RECENT_TYPES_LENGTH)
    recentFinalTagsRef.current = spec.tags
    return { kind: 'final', spec }
  }

  function buildChallenge500Slot(): EndlessQuestionSlot {
    const tier = pick(CHALLENGE500_ENDLESS_TIERS)
    const percent = CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]
    const spec = pickChallenge500Question(percent, recentChallenge500TypeRef.current)
    recentChallenge500TypeRef.current = spec.type
    return { kind: 'challenge500', spec, tier }
  }

  function buildNext(): EndlessQuestionSlot {
    if (difficulty === 'beginner') {
      const spec = generateNextQuestion(ENDLESS_BEGINNER_PHASE, recentTypesRef.current)
      recentTypesRef.current = [spec.type, ...recentTypesRef.current].slice(0, RECENT_TYPES_LENGTH)
      return { kind: 'normal', spec }
    }
    if (difficulty === 'intermediate') {
      return buildFinalSlot()
    }
    // advanced: FINAL系とChallenge500系を既存の問題数ベースの重みで混在させる
    const origin = pickEndlessAdvancedOrigin(recentAdvancedOriginsRef.current)
    recentAdvancedOriginsRef.current = [origin, ...recentAdvancedOriginsRef.current].slice(0, RECENT_TYPES_LENGTH)
    return origin === 'final' ? buildFinalSlot() : buildChallenge500Slot()
  }

  function start() {
    if (startedRef.current) return
    startedRef.current = true
    if (!qaMode) trackEndlessStart(difficulty)
    const slot = buildNext()
    setSnapshot({ state: stateRef.current, currentSlot: slot, milestoneLabel: null, milestoneKey: 0 })
  }

  function handleResult(result: EndlessQuestionOutcome) {
    if (stateRef.current.ended) return

    if (result.correct) {
      const intensity = endlessMilestoneLevel(stateRef.current.streak + 1)
      sfx.endlessCorrect(difficulty, intensity)
      const next = applyEndlessCorrect(stateRef.current)
      stateRef.current = next

      if (isEndlessMilestone(next.streak)) {
        sfx.comboMilestone(endlessMilestoneLevel(next.streak))
        milestoneKeyRef.current += 1
        const milestoneKey = milestoneKeyRef.current
        const label = `${next.streak} STREAK`
        if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
        milestoneTimerRef.current = setTimeout(() => {
          setSnapshot((s) => (s.milestoneKey === milestoneKey ? { ...s, milestoneLabel: null } : s))
        }, MILESTONE_BANNER_MS)
        const nextSlot = buildNext()
        setSnapshot((s) => ({ ...s, state: next, currentSlot: nextSlot, milestoneLabel: label, milestoneKey }))
        return
      }

      const nextSlot = buildNext()
      setSnapshot((s) => ({ ...s, state: next, currentSlot: nextSlot }))
      return
    }

    // MISS（時間切れも各問題コンポーネント／Challenge500TimerBarがcorrect:falseを返すだけで、
    // ここでは区別しない——endlessEngine.applyEndlessMiss参照）。出題元（normal/final/
    // challenge500）に関わらず即終了し、結果を一度だけ通知する。
    sfx.endlessMiss(difficulty)
    const next = applyEndlessMiss(stateRef.current)
    stateRef.current = next
    if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
    const isNewBest = !qaMode && updateEndlessBest(difficulty, next.streak)
    if (isNewBest) sfx.endlessNewBest()
    if (!qaMode) trackEndlessEnd(difficulty, next.streak, isNewBest)
    setSnapshot((s) => ({ ...s, state: next, currentSlot: null, milestoneLabel: null }))
    onFinish({ score: next.streak, isNewBest, best: getEndlessBest(difficulty) })
  }

  return { snapshot, start, handleResult }
}
