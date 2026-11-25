import { getAchievementDefById } from '../config/achievements'
import { PASS_TITLE_DEFS_BY_ID } from '../config/passTitles'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getSecretTheme, getTitleRarityTheme } from '../config/titleRarityTheme'
import { sfx } from '../utils/sound'
import type { TitleId } from '../types'

interface Props {
  titleId: TitleId | null
  /** 'サブ1' / 'サブ2' 等、枠の見出しラベル。 */
  slotLabel: string
  /** 空き枠・onClick未指定の場合はタップしても何も起きない（見るだけ、装備管理UIは開かない）。 */
  onClick?: () => void
}

/**
 * 次フェーズ（item 157-159、挑戦状受信画面のプロフィール表示を通常プロフィールと統一）:
 * 元々ProfileScreen.tsx（item 88/89/123-124）にインラインで実装されていたサブ称号pillを
 * 共通コンポーネントへ抽出した——ユーザー指示「今後デザインを変更した時に表示が分岐
 * しない構造に」どおり、ProfileScreen.tsx（自分自身）とChallengeReceiveScreen.tsx
 * （挑戦状の相手）の両方から全く同じ見た目・同じロジックで使う。
 *
 * PASS限定Title・通常Titleのどちらでも入り得る（profileStorage.tsのsubTitleIdsは
 * TitleId型のまま両方を許容する既存仕様）。SECRET Titleはrarity体系の外側の専用テーマ
 * （getSecretTheme）を使う——メイン称号（TitleBadge.tsx）と同じ区別をサブ枠にも適用する。
 */
export function SubTitleBadge({ titleId, slotLabel, onClick }: Props) {
  const def = titleId ? TITLE_DEFS_BY_ID[titleId] : null
  const passDef = titleId ? PASS_TITLE_DEFS_BY_ID[titleId] : null
  const isSecret = def ? getAchievementDefById(def.id)?.secret === true : false
  const secretTheme = isSecret ? getSecretTheme() : null
  const theme = def && !isSecret ? getTitleRarityTheme(def.rarity) : null
  const filled = Boolean(def || passDef)

  function handleClick() {
    if (!filled) return
    sfx.uiTap()
    onClick?.()
  }

  return (
    <button
      onClick={filled ? handleClick : undefined}
      disabled={!filled}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold active:scale-95 disabled:active:scale-100 ${
        filled
          ? isSecret
            ? `${secretTheme!.unlockedBorderClass} ${secretTheme!.unlockedBackgroundClass} ${secretTheme!.unlockedTextClass}`
            : `${theme ? theme.badgeBorderClass : 'border-amber-400/50'} ${theme ? theme.badgeBackgroundClass : 'bg-amber-500/10'} ${theme ? theme.badgeTextClass : 'text-amber-200'}`
          : 'border-white/10 bg-white/5 text-white/25'
      }`}
    >
      <span className="text-[7px] font-black tracking-widest opacity-60">{slotLabel}</span>
      <span>{def?.name ?? passDef?.name ?? '未装備'}</span>
    </button>
  )
}
