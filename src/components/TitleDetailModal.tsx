import { ACHIEVEMENT_DEFS_BY_ID } from '../config/achievements'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getSecretTheme, getTitleRarityTheme } from '../config/titleRarityTheme'
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
 * ACHIEVED/未解除インジケーター。
 *
 * 次フェーズ（item 117-119、リリース前最終デザインラウンド）: secret指定の実績は、
 * 名称・条件は未解除時「？？？」のまま隠すが、rarity labelは「SECRET」固定で常に表示する
 * ように変更した（以前のラウンドでは「レアリティも隠す」方針だったが、今回のユーザー指示
 * 「rarity表記も『SECRET』（COMMON等ではない）——一目で『普通の未解放称号ではない』と
 * 分かること」により上書きする）。非secretは、ロック中はconfig/titleRarityTheme.tsの
 * lockedXxx（暗い配色）、解放後は従来どおりの鮮やかな配色を使う。
 */
export function TitleDetailModal({ achievementId, unlocked, onClose }: Props) {
  const achievement = ACHIEVEMENT_DEFS_BY_ID[achievementId]
  const title = TITLE_DEFS_BY_ID[achievementId]
  if (!achievement || !title) return null

  const isSecret = achievement.secret === true
  const hidden = isSecret && !unlocked
  const secretTheme = isSecret ? getSecretTheme() : null
  const rarityTheme = !isSecret ? getTitleRarityTheme(title.rarity) : null

  const badgeLabel = isSecret ? 'SECRET' : rarityTheme!.label
  const badgeClass = isSecret
    ? unlocked
      ? `${secretTheme!.unlockedBorderClass} ${secretTheme!.unlockedBackgroundClass} ${secretTheme!.unlockedTextClass}`
      : `${secretTheme!.lockedBorderClass} ${secretTheme!.lockedBackgroundClass} ${secretTheme!.lockedTextClass}`
    : unlocked
      ? `${rarityTheme!.badgeBorderClass} ${rarityTheme!.badgeBackgroundClass} ${rarityTheme!.badgeTextClass}`
      : `${rarityTheme!.lockedBorderClass} ${rarityTheme!.lockedBackgroundClass} ${rarityTheme!.lockedTextClass}`

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-white/10 bg-[#1a0e2e] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className={`mx-auto mb-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-widest ${badgeClass}`}>
          {badgeLabel}
        </p>
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
