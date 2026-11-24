import { getAchievementDefById } from '../config/achievements'
import { getSecretTheme, getTitleRarityTheme } from '../config/titleRarityTheme'
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
 *
 * 次フェーズ（item 117-119, 123-124、リリース前最終デザインラウンド）: SECRET
 * （鏡写し・大逆転等）を装備した場合は、TitleDef.rarityの値（現状'mythic'）に関わらず、
 * MYTHICとは別のSECRET専用テーマ（config/titleRarityTheme.tsのgetSecretTheme）を使う
 * ——「SECRETはMYTHICより上ではなく完全に別物」というユーザー指示をProfile装備表示にも
 * 一貫させるため。
 *
 * 次フェーズ（item 136、追加最終調整ラウンド）: 以前はMYTHICだけ「外側＝虹グラデーション
 * のリング、内側＝黒に近い専用背景（#1a0e2e）」という2重divの特殊構造にしていたが、
 * 「メインバッジだけサブ1/サブ2と違う黒背景の特殊スタイルになっている。背景を黒くする
 * 必要はなく、メインとサブの差は大きさだけで十分」というユーザー指示により、この特殊
 * 構造を廃止した。全rarity共通の1重pill（border+background+text、ProfileScreen.tsxの
 * サブ1/サブ2バッジと全く同じクラス構成）に統一する——MYTHICのbadgeBorderClassは
 * 元々transparentな枠色＋虹グラデーションのbackground-imageを兼ねており、
 * badgeBackgroundClass（background-color）より前面に描画される（CSSのbackground-image
 * がbackground-colorの上に重なる仕様）ため、1重pillにしても虹グラデーションはそのまま
 * 正しく見える。メイン/サブの差は見た目の構造ではなく大きさ（px-4 py-1.5・text-smの
 * メインに対し、サブはpx-2 py-0.5・text-[9px]）だけになった。
 */
export function TitleBadge({ title, onClick }: Props) {
  const isSecret = getAchievementDefById(title.id)?.secret === true

  if (isSecret) {
    const secretTheme = getSecretTheme()
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 active:scale-95 ${secretTheme.unlockedBorderClass} ${secretTheme.unlockedBackgroundClass} ${secretTheme.unlockedGlowClass} ${secretTheme.unlockedPulseClass}`}
      >
        <span className="text-[9px] font-black tracking-widest text-indigo-300/70">{secretTheme.label}</span>
        <span className={`text-sm font-black ${secretTheme.unlockedTextClass}`}>{title.name}</span>
      </button>
    )
  }

  const theme = getTitleRarityTheme(title.rarity)

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
