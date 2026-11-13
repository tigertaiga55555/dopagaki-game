import { AdSlot } from '../components/AdSlot'
import { AD_START_SCREEN } from '../config/ads'
import { HOME_MODES, type HomeModeId } from '../config/homeConfig'
import { TITLE_TEXT } from '../config/messagesV4'
import { getBestPercent } from '../utils/storage'

interface Props {
  onStart: () => void
  /** Ver.6 Phase 4: Endless難易度選択画面への入口。 */
  onStartEndless: () => void
  /** Ver.6 Phase 6（1対1リアルタイム対戦）: BATTLE（世界対戦・フレンド対戦）への入口。 */
  onStartBattle: () => void
  /** Ver.6 Phase 5: Profile/Achievement/Rankingへのサブ導線。 */
  onOpenProfile: () => void
  onOpenAchievements: () => void
  onOpenRanking: () => void
}

/**
 * Ver.6 Phase 7（ホーム画面最終UI改善、実機QA確定）: 3モード（DOPA RUSH/ENDLESS/
 * ONLINE BATTLE）を同格のカードとして並べる構成自体はPhase 6から維持しつつ、
 * 名称・サブコピー・配色をconfig/homeConfig.tsのデータに基づいて描画するよう
 * 書き換えた（英語タイトルを主役にし、その下に短い日本語説明を添える）。
 * Profile/Achievement/Rankingは従来どおり控えめなテキストリンクのまま維持する。
 */
export function TitleScreen({ onStart, onStartEndless, onStartBattle, onOpenProfile, onOpenAchievements, onOpenRanking }: Props) {
  const best = getBestPercent()

  const handlers: Record<HomeModeId, () => void> = {
    rush: onStart,
    endless: onStartEndless,
    battle: onStartBattle,
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 py-8 text-center">
      <h1 className="text-4xl font-black tracking-tight">{TITLE_TEXT.heading}</h1>

      <div className="space-y-2 text-base font-bold leading-relaxed text-white/85">
        {TITLE_TEXT.lines.map((line) => (
          <p key={line} className="whitespace-pre-line">
            {line}
          </p>
        ))}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {HOME_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={handlers[mode.id]}
            className={`w-full rounded-2xl py-2.5 text-white transition-transform active:translate-y-1 active:shadow-none ${mode.gradientClass} ${mode.shadowClass}`}
          >
            <span className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="text-xl leading-none" aria-hidden="true">
                  {mode.icon}
                </span>
                <span className="text-xl font-black leading-none tracking-widest">{mode.titleEn}</span>
              </span>
              <span className="text-[11px] font-bold text-white/90">{mode.subJa}</span>
            </span>
          </button>
        ))}
      </div>

      {best > 0 && <p className="text-xs text-white/40">自己ベスト：ドパガキ度 {best}％</p>}

      {/* Ver.6 Phase 5: Profile/Achievement/Rankingへのサブ導線。ゲームモード選択の主導線を
          弱めないよう、あくまで控えめな小さいテキストリンク3つに留める
          （アプリの管理画面のような見た目にしない）。 */}
      <div className="flex items-center gap-4 text-[11px] font-bold text-white/35">
        <button onClick={onOpenProfile} className="flex items-center gap-1 active:text-white/60">
          <span aria-hidden="true">👤</span> PROFILE
        </button>
        <span className="text-white/15">|</span>
        <button onClick={onOpenAchievements} className="flex items-center gap-1 active:text-white/60">
          <span aria-hidden="true">🏆</span> ACHIEVEMENT
        </button>
        <span className="text-white/15">|</span>
        <button onClick={onOpenRanking} className="flex items-center gap-1 active:text-white/60">
          <span aria-hidden="true">📊</span> RANKING
        </button>
      </div>

      <AdSlot adTag={AD_START_SCREEN.tag} width={AD_START_SCREEN.width} height={AD_START_SCREEN.height} label={AD_START_SCREEN.slotName} />
    </div>
  )
}
