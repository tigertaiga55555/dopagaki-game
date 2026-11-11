import { AdSlot } from '../components/AdSlot'
import { AD_START_SCREEN } from '../config/ads'
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
 * Ver.6 Phase 6（ホーム画面再設計）: 通常・ENDLESS・BATTLEをゲームモードとして並列に
 * 選べるレイアウトに変更した（以前は通常だけが巨大STARTで、ENDLESS/BATTLEが小さい
 * サブボタンという非対称な構成だった）。通常モードは既定の入口として一番上・一番大きい
 * ままだが、ENDLESS・BATTLEも「サブ導線」ではなく同格のモードカードとして並べる。
 * Profile/Achievement/Rankingは従来どおり控えめなテキストリンクのまま維持する。
 */
export function TitleScreen({ onStart, onStartEndless, onStartBattle, onOpenProfile, onOpenAchievements, onOpenRanking }: Props) {
  const best = getBestPercent()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 py-10 text-center">
      <h1 className="text-4xl font-black tracking-tight">{TITLE_TEXT.heading}</h1>

      <div className="space-y-3 text-base font-bold leading-relaxed text-white/85">
        {TITLE_TEXT.lines.map((line) => (
          <p key={line} className="whitespace-pre-line">
            {line}
          </p>
        ))}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-5 text-xl font-black tracking-widest text-white shadow-[0_8px_0_0_rgba(126,34,206,0.8)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(126,34,206,0.8)]"
        >
          {TITLE_TEXT.startButton}
        </button>

        <button
          onClick={onStartEndless}
          className="w-full rounded-2xl border border-white/15 bg-white/5 py-4 text-base font-black tracking-widest text-white/85 shadow-[0_4px_0_0_rgba(255,255,255,0.08)] transition-transform active:translate-y-1 active:shadow-none"
        >
          ENDLESS
        </button>

        {/* Ver.6 Phase 6: 1対1リアルタイム対戦。対人戦らしい緊張感を出すため、他の2モードとは
            違う色味（赤〜薔薇色）だけをこのボタンに与える。 */}
        <button
          onClick={onStartBattle}
          className="w-full rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 py-4 text-base font-black tracking-widest text-white shadow-[0_4px_0_0_rgba(136,19,55,0.9)] transition-transform active:translate-y-1 active:shadow-none"
        >
          ⚔️ BATTLE
        </button>
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
