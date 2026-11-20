import type { TitleRarity } from '../types'

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 9/12）: Titleのレアリティ（COMMON〜
 * MYTHIC）ごとの見た目テーマ。challenge500Theme.tsと同じ方針で、DOM/Reactに依存しない
 * 純粋なデータ・計算のみをここに置き、実際の描画（ProfileScreen.tsxのTitleBadge・
 * AchievementScreen.tsxのタップ時詳細モーダル）はこの値をTailwindクラスへそのまま
 * 適用する薄い層として実装する。
 *
 * 配色方針（ユーザー指示）: ENDLESS難易度の配色（beginner/intermediate/advanced）とは
 * 完全に別の色相を使い混同を避ける——
 *   COMMON    = グレー/白（既存の装備枠と同じく控えめ）
 *   RARE      = 青〜シアン
 *   EPIC      = 紫
 *   LEGENDARY = 金（ENDLESS上級の赤系・DOPA%系の金系とは別文脈として、Profile上では
 *               「称号の金」として明確に区別するためborder/glowをより強くする）
 *   MYTHIC    = 虹色グラデーション＋発光
 *
 * アニメーションは「常時ギラギラ動き続ける」ものにはしない（ユーザー指示：一目で凄いと
 * 分かる程度に留める）。LEGENDARY/MYTHICのみ、ゆっくりした息づくようなpulse
 * （既存のanim-pop等と同系統の軽いCSS transitionで十分、専用keyframesは増やさない）を
 * 許容するが、常時振動するような演出は避ける。
 */

export interface TitleRarityTheme {
  rarity: TitleRarity
  label: string
  /** Title Badge（Profile/Achievement詳細共通）の見た目。 */
  badgeBorderClass: string
  badgeBackgroundClass: string
  badgeTextClass: string
  /** LEGENDARY/MYTHICのみ強いglow（box-shadow）を追加する。それ以外は空文字。 */
  badgeGlowClass: string
  /** LEGENDARY/MYTHICのみ、ゆっくりしたpulseアニメーションを許容する（item 9）。 */
  badgePulseClass: string
  /**
   * item 12: Profileカード/アバターリングへ軽く拡張してよい高レアリティの装飾
   * （LEGENDARY=金リング、MYTHIC=虹リング）。COMMON/RARE/EPICは既存の見た目を変えない
   * ため空文字（＝Profile全体を過剰に色付けしない）。
   */
  profileRingClass: string
}

const THEMES: Record<TitleRarity, TitleRarityTheme> = {
  common: {
    rarity: 'common',
    label: 'COMMON',
    badgeBorderClass: 'border-white/25',
    badgeBackgroundClass: 'bg-white/10',
    badgeTextClass: 'text-white/80',
    badgeGlowClass: '',
    badgePulseClass: '',
    profileRingClass: '',
  },
  rare: {
    rarity: 'rare',
    label: 'RARE',
    badgeBorderClass: 'border-cyan-300/50',
    badgeBackgroundClass: 'bg-cyan-400/10',
    badgeTextClass: 'text-cyan-200',
    badgeGlowClass: '',
    badgePulseClass: '',
    profileRingClass: '',
  },
  epic: {
    rarity: 'epic',
    label: 'EPIC',
    badgeBorderClass: 'border-fuchsia-400/60',
    badgeBackgroundClass: 'bg-fuchsia-500/15',
    badgeTextClass: 'text-fuchsia-200',
    badgeGlowClass: 'shadow-[0_0_14px_rgba(217,70,239,0.35)]',
    badgePulseClass: '',
    profileRingClass: '',
  },
  legendary: {
    rarity: 'legendary',
    label: 'LEGENDARY',
    badgeBorderClass: 'border-amber-300/80',
    badgeBackgroundClass: 'bg-gradient-to-r from-amber-400/25 via-yellow-300/15 to-amber-400/25',
    badgeTextClass: 'text-amber-200',
    badgeGlowClass: 'shadow-[0_0_22px_rgba(250,204,21,0.5)]',
    badgePulseClass: 'anim-rarity-pulse-slow',
    profileRingClass: 'ring-2 ring-amber-300/70 shadow-[0_0_20px_rgba(250,204,21,0.4)]',
  },
  mythic: {
    rarity: 'mythic',
    label: 'MYTHIC',
    badgeBorderClass: 'border-transparent bg-[linear-gradient(90deg,#ff5f6d,#ffc371,#47e5bc,#5b8dff,#c05cff,#ff5f6d)] bg-[length:300%_100%]',
    badgeBackgroundClass: 'bg-[#1a0e2e]',
    badgeTextClass: 'text-white',
    badgeGlowClass: 'shadow-[0_0_26px_rgba(199,92,255,0.5)]',
    badgePulseClass: 'anim-rarity-rainbow-slow',
    profileRingClass: 'ring-2 ring-fuchsia-300/70 anim-rarity-rainbow-slow shadow-[0_0_24px_rgba(199,92,255,0.45)]',
  },
}

export function getTitleRarityTheme(rarity: TitleRarity): TitleRarityTheme {
  return THEMES[rarity]
}
