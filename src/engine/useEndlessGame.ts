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
import { endlessSlotToProblemSetItem, problemSetItemToEndlessSlot } from './endlessReplay'
import { pickFinalQuestion } from './finalQuestionPicker'
import { generateNextQuestion } from './questionPicker'
import { pick } from './random'
import { pickChallenge500Question } from '../questions/challenge500'
import { checkEndlessAchievements } from '../utils/achievementStorage'
import { trackEndlessEnd, trackEndlessStart } from '../utils/analytics'
import { getEndlessBest, updateEndlessBest } from '../utils/storage'
import { sfx } from '../utils/sound'
import type { ChallengeProblemSetItem } from '../challenge/types'
import type { Challenge500QuestionSpec, Challenge500Tier } from '../questions/challenge500/types'
import type { AchievementId, EndlessDifficulty, FinalQuestionSpec, FinalQuestionTag, QuestionSpec, QuestionTypeId } from '../types'

/** Ver.6 Phase 8（ENDLESS Challenge）: 1件のChallengeへ保存する問題数の上限（Worker側validation.tsと同じ値）。 */
const MAX_RECORDED_PROBLEMS = 300

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
  /** Ver.6 Phase 5.1: 今回のプレイで新たに解除されたEndless実績（qaModeでは常に空配列）。 */
  newlyUnlockedAchievements: AchievementId[]
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: 終了理由。通常のENDLESS（1 MISS = END）は常に'miss'。
   * 'targetExceeded'は、targetStreak指定時に挑戦者がTARGETを超えた瞬間の即WIN終了のみ。
   */
  endedReason: 'miss' | 'targetExceeded'
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: このプレイで実際に出題された問題列。結果画面の
   * 「挑戦状を送る」がこれをそのままChallengeのproblemSetとして送信する
   * （getRecordedProblemSet()と同じ内容をpayloadにも含めておくことで、呼び出し元が
   * 別途hookの参照を持ち回さずに済むようにする）。
   */
  recordedProblemSet: ChallengeProblemSetItem[]
}

export interface UseEndlessGameOptions {
  /**
   * Preview/QA専用モード。trueの場合、GA4のendless_start/endless_end送信と
   * localStorageの自己ベスト更新を両方抑制する（既存のuseChallenge500.tsと同じ方針：
   * QA操作を実際のプレイ記録として残さない）。
   * Ver.6 Phase 8（ENDLESS Challenge）: ENDLESS Challengeへの挑戦プレイ（replayQuestions
   * 指定時）も必ずこれをtrueにする——挑戦者の記録が公式ENDLESS BEST/Ranking/Achievementへ
   * 絶対に反映されないようにするための、既存の実績ある遮断機構をそのまま再利用する。
   */
  qaMode?: boolean
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: 指定されると、通常のランダム出題の代わりに
   * この配列を順番に出題する（挑戦者が、ホストと完全に同じ問題・同じ順番で再生するため）。
   * 配列を使い切った後は、元々の問題生成ロジックへ自動的にフォールバックする
   * （useChallenge500.tsのreplayQuestionsと同じ方針）。
   */
  replayQuestions?: ChallengeProblemSetItem[]
  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: ホストの記録（STREAK数）。指定されている間、
   * 正解のたびにstreakがこれを超えたかを確認し、超えた瞬間に即WIN終了する
   * （そのまま記録を伸ばし続けるモードにはしない、というユーザー指示）。
   */
  targetStreak?: number
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
  const targetStreak = options?.targetStreak

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
  const replayQuestionsRef = useRef(options?.replayQuestions)
  const replayIndexRef = useRef(0)
  const recordedRef = useRef<ChallengeProblemSetItem[]>([])

  /** Ver.6 Phase 8（ENDLESS Challenge）: このプレイで実際に出題された問題列（Challenge作成に使う）。 */
  function getRecordedProblemSet(): ChallengeProblemSetItem[] {
    return recordedRef.current
  }

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

  function buildRandomNext(): EndlessQuestionSlot {
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

  /**
   * Ver.6 Phase 8（ENDLESS Challenge）: replayQuestionsが指定されている間は、ランダム出題の
   * 代わりにそれを順番に消費する（ホストと完全に同じ問題・同じ順番で再生するため、別random
   * 生成は行わない）。使い切った後は自動的にbuildRandomNext()へフォールバックする
   * （useChallenge500.tsのbuildNextと同じ方針）。実際に出題された問題は常にrecordedRefへ
   * 記録する（Challenge未使用の通常プレイでも、結果画面の「挑戦状を送る」に使えるよう
   * 常時記録しておく）。
   */
  function buildNext(): EndlessQuestionSlot {
    const replayQuestions = replayQuestionsRef.current
    let slot: EndlessQuestionSlot
    if (replayQuestions && replayIndexRef.current < replayQuestions.length) {
      slot = problemSetItemToEndlessSlot(replayQuestions[replayIndexRef.current])
      replayIndexRef.current += 1
      // 再生中も「直近タイプ」ヒューリスティクスを更新しておき、再生を使い切った直後の
      // ランダム出題がいきなり同じタイプへ偏らないようにする（buildRandomNext内の各分岐が
      // 自分で更新するのと同じ値を、再生時はここで代わりに更新する）。
      if (slot.kind === 'normal') {
        recentTypesRef.current = [slot.spec.type, ...recentTypesRef.current].slice(0, RECENT_TYPES_LENGTH)
      } else if (slot.kind === 'final') {
        recentFinalTypesRef.current = [slot.spec.type, ...recentFinalTypesRef.current].slice(0, RECENT_TYPES_LENGTH)
        recentFinalTagsRef.current = slot.spec.tags
      } else {
        recentChallenge500TypeRef.current = slot.spec.type
      }
    } else {
      slot = buildRandomNext()
    }
    if (recordedRef.current.length < MAX_RECORDED_PROBLEMS) {
      recordedRef.current = [...recordedRef.current, endlessSlotToProblemSetItem(slot)]
    }
    return slot
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

      // Ver.6 Phase 8（ENDLESS Challenge）: TARGET（ホストのSTREAK数）を超えた瞬間に即WIN終了する。
      // そのまま記録を伸ばし続けるモードにはしない、というユーザー指示（item 11）。
      if (targetStreak !== undefined && next.streak > targetStreak) {
        if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
        setSnapshot((s) => ({ ...s, state: next, currentSlot: null, milestoneLabel: null }))
        onFinish({
          score: next.streak,
          isNewBest: false,
          best: getEndlessBest(difficulty),
          newlyUnlockedAchievements: [],
          endedReason: 'targetExceeded',
          recordedProblemSet: getRecordedProblemSet(),
        })
        return
      }

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
    // Ver.6 Phase 5.1: Endless STREAK実績。qaModeではDOPA%実績・自己ベスト更新と同様、一切解除しない。
    const newlyUnlockedAchievements = qaMode ? [] : checkEndlessAchievements(difficulty, next.streak)
    setSnapshot((s) => ({ ...s, state: next, currentSlot: null, milestoneLabel: null }))
    onFinish({
      score: next.streak,
      isNewBest,
      best: getEndlessBest(difficulty),
      newlyUnlockedAchievements,
      endedReason: 'miss',
      recordedProblemSet: getRecordedProblemSet(),
    })
  }

  return { snapshot, start, handleResult, getRecordedProblemSet }
}
