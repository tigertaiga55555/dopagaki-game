import { AchievementUnlockBanner } from '../components/AchievementUnlockBanner'
import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import type { AchievementId, EndlessDifficulty } from '../types'

interface Props {
  difficulty: EndlessDifficulty
  score: number
  best: number
  isNewBest: boolean
  newlyUnlockedAchievements: AchievementId[]
  onRetry: () => void
  onChangeDifficulty: () => void
  onHome: () => void
}

/**
 * Ver.6 Phase 4.1（難易度再設計）: Endless結果画面。最低限（ENDLESS RESULT／難易度／
 * 今回のスコア／自己ベスト）のみを表示し、既存の結果画面（ResultScreen.tsx）の
 * FinalResultV4・Canvas共有は一切流用しない（Endlessにはシェア機能の要求がないため、
 * スコープ外の機能を持ち込まない）。難易度ラベル・スコア数値・「もう一度」ボタンに
 * config/endlessTheme.tsのアクセントカラーを適用し、どの難易度で終えたかを結果画面でも
 * 一目で分かるようにする（NEW BESTバッジだけは「達成」を表す共通色としてamberのまま据え置く）。
 */
export function EndlessResultScreen({
  difficulty,
  score,
  best,
  isNewBest,
  newlyUnlockedAchievements,
  onRetry,
  onChangeDifficulty,
  onHome,
}: Props) {
  const theme = ENDLESS_THEME[difficulty]
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <AchievementUnlockBanner newlyUnlocked={newlyUnlockedAchievements} />

      <div className="flex flex-col items-center gap-1">
        <p className="text-xs font-black tracking-[0.3em] text-white/40">ENDLESS RESULT</p>
        <p className={`text-lg font-black ${theme.textClass}`}>
          {ENDLESS_DIFFICULTY_LABEL[difficulty]} <span className="text-xs font-black tracking-[0.2em] opacity-80">{theme.mood}</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className={`text-6xl font-black tabular-nums leading-none text-white ${theme.glowClass}`}>
          {score}
          <span className="ml-2 text-2xl align-middle text-white/60">STREAK</span>
        </p>
        {isNewBest && (
          <p className="anim-pop text-sm font-black tracking-[0.25em] text-amber-300 drop-shadow-[0_0_14px_rgba(250,204,21,0.8)]">
            NEW BEST
          </p>
        )}
        <p className="text-xs font-bold tabular-nums text-white/50">BEST {best}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onRetry}
          className={`w-full rounded-2xl py-4 text-lg font-black tracking-widest text-white transition-transform active:translate-y-1 ${theme.buttonGradientClass} ${theme.buttonShadowClass}`}
        >
          もう一度
        </button>
        <button onClick={onChangeDifficulty} className="w-full rounded-2xl bg-white/10 py-3 text-base font-bold text-white active:scale-95">
          難易度を選ぶ
        </button>
        <button onClick={onHome} className="w-full rounded-2xl bg-transparent py-2 text-sm font-bold text-white/50 active:scale-95">
          ホームへ戻る
        </button>
      </div>
    </div>
  )
}
