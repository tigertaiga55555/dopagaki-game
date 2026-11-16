import { ENDLESS_DIFFICULTIES, ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { BackButton } from '../components/BackButton'
import { getEndlessBest } from '../utils/storage'
import type { EndlessDifficulty } from '../types'

interface Props {
  onSelect: (difficulty: EndlessDifficulty) => void
  onBack: () => void
}

/**
 * Ver.6 Phase 4.1（難易度再設計）: Endless難易度選択画面。
 * 説明は短く（ENDLESS / 何問連続で正解できる？ / 1 MISS = END・時間切れも終了の3行のみ）、
 * 初級・中級・上級の3ボタンで即開始できるようにする。既存ホーム画面（TitleScreen）の
 * ボタン形状（rounded-2xl、font-black）は踏襲しつつ、3枚のカードそれぞれに
 * config/endlessTheme.tsの難易度別アクセントカラー（緑/シアン/赤）を適用し、
 * 「選んだ瞬間に別カテゴリだと分かる」見た目にする。
 *
 * Ver.6 Phase 9（実機QA反映）: この画面はまだ「難易度を選ぶだけ」でプレイが始まっていないため、
 * 従来の「×やめる」（QuitButton、プレイ中であることを前提にした文言）は意味的に不適切。
 * 「←ホームへ戻る」（BackButton、Profile/Achievement/Ranking等のメニュー系画面と同じ部品）に
 * 差し替える。実際にプレイが始まった後のEndlessPlayScreen（rule/countdown/playing全フェーズ）の
 * 「×やめる」は、実機QAで3回調整済みのセンシティブな既存コンポーネントのため一切変更しない。
 */
export function EndlessSelectScreen({ onSelect, onBack }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onBack} label="ホーム" />

      {/* Ver.6 Phase 9（実機QA反映）: このカード群自体は広告を持たないが、ホーム画面と同様に
          「ドパガキゲーム全体から広告が消えた」文脈に合わせて、上下の余白比率を少しだけ
          下寄りにし、画面全体がより中央〜やや下に収まって見えるようにする
          （カードサイズ・配色・説明文は一切変更しない）。 */}
      <div className="flex flex-1 flex-col items-center gap-10 px-6 py-4 text-center">
        <div aria-hidden="true" className="flex-[1]" />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-black tracking-[0.2em] text-fuchsia-300">ENDLESS</h1>
          <p className="text-base font-bold text-white/85">何問連続で正解できる？</p>
          <p className="text-xs font-bold text-white/40">1 MISS = END　時間切れも終了</p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          {ENDLESS_DIFFICULTIES.map((difficulty) => {
            const best = getEndlessBest(difficulty)
            const theme = ENDLESS_THEME[difficulty]
            return (
              <button
                key={difficulty}
                onClick={() => onSelect(difficulty)}
                className={`flex items-center justify-between rounded-2xl px-5 py-4 text-left transition-transform active:scale-95 ${theme.cardClass}`}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="text-xl font-black text-white">{ENDLESS_DIFFICULTY_LABEL[difficulty]}</span>
                  <span className={`text-[10px] font-black tracking-[0.2em] ${theme.textClass}`}>{theme.mood}</span>
                </span>
                <span className={`text-xs font-bold tabular-nums ${best > 0 ? theme.textClass : 'text-white/40'}`}>
                  {best > 0 ? `BEST ${best}` : '-'}
                </span>
              </button>
            )
          })}
        </div>
        <div aria-hidden="true" className="flex-[1.3]" />
      </div>
    </div>
  )
}
