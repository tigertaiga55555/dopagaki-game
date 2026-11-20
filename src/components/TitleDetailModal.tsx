import { ACHIEVEMENT_DEFS_BY_ID } from '../config/achievements'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getTitleRarityTheme } from '../config/titleRarityTheme'
import type { AchievementId } from '../types'

interface Props {
  achievementId: AchievementId
  unlocked: boolean
  onClose: () => void
}

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 10）: Titleタップ時の詳細モーダル。
 * ProfileScreen.tsx（装備中バッジタップ）とAchievementScreen.tsx（実績カードタップ）の
 * 両方から同じコンポーネントを呼ぶことで、詳細表示を2重実装しない（ユーザー指示）。
 *
 * 表示内容: Title名・レアリティ・元になったAchievementの解除条件（description）・
 * ACHIEVED/未解除インジケーター。secret指定のAchievementが未解除の場合は、
 * 既存のAchievementScreen.tsxと同じ「？？？」マスキングを踏襲し、名称だけでなく
 * レアリティも隠す（item 11のユーザー指示：「ロック中のSecretはrarityも隠す方が
 * 自然ならそれでよい」を採用——未解除のSecretはレアリティがMYTHIC級であること自体が
 * ネタバレになるため）。
 */
export function TitleDetailModal({ achievementId, unlocked, onClose }: Props) {
  const achievement = ACHIEVEMENT_DEFS_BY_ID[achievementId]
  const title = TITLE_DEFS_BY_ID[achievementId]
  if (!achievement || !title) return null

  const hidden = achievement.secret === true && !unlocked
  const theme = getTitleRarityTheme(title.rarity)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-white/10 bg-[#1a0e2e] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {!hidden && (
          <p
            className={`mx-auto mb-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-widest ${theme.badgeBorderClass} ${theme.badgeBackgroundClass} ${theme.badgeTextClass}`}
          >
            {theme.label}
          </p>
        )}
        <h2 className="mb-1 text-lg font-black text-white">{hidden ? '？？？' : title.name}</h2>
        <p className="mb-4 text-xs leading-relaxed text-white/50">{hidden ? '？？？' : achievement.description}</p>
        <p className={`mb-5 text-xs font-black ${unlocked ? 'text-emerald-300' : 'text-white/30'}`}>{unlocked ? '✓ ACHIEVED' : '未解除'}</p>

        <button onClick={onClose} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-black text-white active:scale-95">
          閉じる
        </button>
      </div>
    </div>
  )
}
