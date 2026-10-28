import { ENDLESS_DIFFICULTIES, ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { QuitButton } from '../components/QuitButton'
import { getEndlessBest } from '../utils/storage'
import type { EndlessDifficulty } from '../types'

interface Props {
  onSelect: (difficulty: EndlessDifficulty) => void
  onQuit: () => void
}

/**
 * Ver.6 Phase 4: Endless難易度選択画面。
 * 説明は短く（ENDLESS / 何問連続で正解できる？ / 1 MISS = END・時間切れも終了の3行のみ）、
 * 初級・中級・上級の3ボタンで即開始できるようにする。既存ホーム画面（TitleScreen）の
 * ボタン・配色（fuchsia〜purpleのグラデーション、rounded-2xl、font-black）を踏襲し、
 * 不自然に新しいデザイン言語を持ち込まない。
 */
export function EndlessSelectScreen({ onSelect, onQuit }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <QuitButton onQuit={onQuit} />

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-black tracking-[0.2em] text-fuchsia-300">ENDLESS</h1>
          <p className="text-base font-bold text-white/85">何問連続で正解できる？</p>
          <p className="text-xs font-bold text-white/40">1 MISS = END　時間切れも終了</p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          {ENDLESS_DIFFICULTIES.map((difficulty) => {
            const best = getEndlessBest(difficulty)
            return (
              <button
                key={difficulty}
                onClick={() => onSelect(difficulty)}
                className="flex items-center justify-between rounded-2xl bg-white/10 px-5 py-4 text-left transition-transform active:scale-95"
              >
                <span className="text-xl font-black text-white">{ENDLESS_DIFFICULTY_LABEL[difficulty]}</span>
                <span className="text-xs font-bold tabular-nums text-white/40">{best > 0 ? `BEST ${best}` : '-'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
