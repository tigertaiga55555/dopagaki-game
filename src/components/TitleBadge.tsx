import { getTitleRarityTheme } from '../config/titleRarityTheme'
import type { TitleDef } from '../types'

interface Props {
  title: TitleDef
  onClick?: () => void
}

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 6/9）: ProfileScreen.tsxの装備中Title
 * 表示を、プレーンテキストから「レアリティで見た目が変わる、はっきり視認できるバッジ」へ
 * 置き換える。AchievementScreen.tsx側の実績カードとは別の、Profile専用の主役表示として
 * プレイヤー名の直下に置く想定（item 6）。
 *
 * MYTHICのみ、枠自体を虹グラデーションにするため構造を分ける（外側＝グラデーション、
 * 内側＝濃色背景の2重divで「細い虹の縁取り」を作る）。それ以外のrarityは通常の
 * border+背景色の1重pillで表現する（過剰な演出を避ける、item 9のユーザー指示）。
 */
export function TitleBadge({ title, onClick }: Props) {
  const theme = getTitleRarityTheme(title.rarity)

  if (title.rarity === 'mythic') {
    return (
      <button
        onClick={onClick}
        className={`rounded-full p-[1.5px] active:scale-95 ${theme.badgeBorderClass} ${theme.badgePulseClass} ${theme.badgeGlowClass}`}
      >
        <span className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${theme.badgeBackgroundClass}`}>
          <span className="text-[9px] font-black tracking-widest text-white/50">{theme.label}</span>
          <span className={`text-sm font-black ${theme.badgeTextClass}`}>{title.name}</span>
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 active:scale-95 ${theme.badgeBorderClass} ${theme.badgeBackgroundClass} ${theme.badgeGlowClass} ${theme.badgePulseClass}`}
    >
      <span className="text-[9px] font-black tracking-widest text-white/40">{theme.label}</span>
      <span className={`text-sm font-black ${theme.badgeTextClass}`}>{title.name}</span>
    </button>
  )
}
