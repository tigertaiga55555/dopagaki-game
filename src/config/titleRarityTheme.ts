import type { TitleRarity } from '../types'

/**
 * Ver.6 Phase 10（実績拡張ラウンド）→ゲーム機能クローズラウンド（item 117-119、リリース前
 * 最終デザインラウンド）: Titleのレアリティ（COMMON〜MYTHIC）ごとの見た目テーマ。
 *
 * 次フェーズ（item 117-119）: 「ロック中でも、このカードがCOMMONっぽい／RAREっぽい／…と
 * 分かるが、解放後との差は必ず残る」というユーザー指示に合わせ、各rarityに
 * lockedXxx（暗く・低彩度・発光なし）とunlockedXxx（従来の鮮やかな表現、既存フィールド名の
 * ままbadgeXxxとして維持——ProfileScreen.tsx/TitleBadge.tsx/TitleDetailModal.tsxの既存の
 * 参照を壊さないため）の2系統を持たせた。SECRET（鏡写し・大逆転等）はTitleRarityの5段階
 * には含めず、完全に別物の専用テーマ（getSecretTheme）として扱う——「MYTHICより上」ではなく
 * 「通常rarity体系の外側」という扱い（ユーザー指示）。
 *
 * 配色方針:
 *   COMMON    = 白/シルバー系。シンプル、発光ほぼ無し。
 *   RARE      = シアン/青系。軽い発光。
 *   EPIC      = 紫/マゼンタ系。明確な発光＋控えめな粒子（複数box-shadowで疑似的に表現）。
 *   LEGENDARY = 金/オレンジ系。金属的なグラデーション＋強めの外周発光＋ゆっくりしたpulse。
 *   MYTHIC    = LEGENDARYより明確に別格——虹彩グラデーション＋専用の強い発光＋pulse。
 *   SECRET    = 上記のどれとも被らない、深い藍〜紫の「異質」な色（ユーザー指示：
 *               一目で「普通の未解放称号ではない」と分かること）。
 *
 * アニメーションは「常時ギラギラ動き続ける」ものにはしない。LEGENDARY/MYTHIC/SECRETのみ、
 * ゆっくりした息づくようなpulse（既存のanim-rarity-*系と同じ、専用keyframesは増やさない）を
 * 許容する。item 125: prefers-reduced-motionはglobals.css側のanim-*定義で配慮する
 * （このファイル自体はクラス名を返すだけで、メディアクエリの実体はCSS側に閉じる）。
 */

export interface TitleRarityTheme {
  rarity: TitleRarity
  label: string
  /** Title Badge（Profile/Achievement詳細共通）の解放後の見た目。 */
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
  /**
   * 次フェーズ（item 117-118）: 未解放カードの見た目（AchievementScreen.tsxのグリッド
   * カード用）。rarity色をかなり暗く・低彩度にした枠＋背景のみ——発光・pulseは一切付けない
   * （「ロック中でも欲しくなる」が、解放後との差は必ず残るようにする）。
   */
  lockedBorderClass: string
  lockedBackgroundClass: string
  lockedTextClass: string
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
    lockedBorderClass: 'border-white/10',
    lockedBackgroundClass: 'bg-white/[0.03]',
    lockedTextClass: 'text-white/30',
  },
  rare: {
    rarity: 'rare',
    label: 'RARE',
    badgeBorderClass: 'border-cyan-300/50',
    badgeBackgroundClass: 'bg-cyan-400/10',
    badgeTextClass: 'text-cyan-200',
    badgeGlowClass: 'shadow-[0_0_10px_rgba(103,232,249,0.3)]',
    badgePulseClass: '',
    profileRingClass: '',
    lockedBorderClass: 'border-cyan-900/40',
    lockedBackgroundClass: 'bg-cyan-950/20',
    lockedTextClass: 'text-cyan-200/25',
  },
  epic: {
    rarity: 'epic',
    label: 'EPIC',
    badgeBorderClass: 'border-fuchsia-400/60',
    badgeBackgroundClass: 'bg-fuchsia-500/15',
    badgeTextClass: 'text-fuchsia-200',
    // item 117: 「控えめな粒子」を、複数の小さなbox-shadowを重ねて疑似的に表現する
    // （専用パーティクルDOM/キャンバスは追加しない——軽量さを優先）。
    badgeGlowClass:
      'shadow-[0_0_16px_rgba(217,70,239,0.4),2px_-6px_0_-3px_rgba(232,121,249,0.5),-3px_5px_0_-3px_rgba(232,121,249,0.4)]',
    badgePulseClass: '',
    profileRingClass: '',
    lockedBorderClass: 'border-fuchsia-950/50',
    lockedBackgroundClass: 'bg-fuchsia-950/20',
    lockedTextClass: 'text-fuchsia-200/25',
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
    lockedBorderClass: 'border-amber-900/50',
    lockedBackgroundClass: 'bg-amber-950/20',
    lockedTextClass: 'text-amber-200/25',
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
    // MYTHICロック中は虹グラデーションを使わない（解放後だけの特別感を守るため）——
    // 暗い紫系の枠だけに留め、RARE/EPIC等と見分けがつく程度の最低限のヒントにする。
    lockedBorderClass: 'border-purple-900/60',
    lockedBackgroundClass: 'bg-purple-950/25',
    lockedTextClass: 'text-purple-200/25',
  },
}

export function getTitleRarityTheme(rarity: TitleRarity): TitleRarityTheme {
  return THEMES[rarity]
}

/**
 * 次フェーズ（item 117-119）: SECRET専用テーマ。通常rarity体系（common〜mythic）には
 * 属さない——「MYTHICより上」ではなく「完全に別物」という扱いのため、TitleRarityを
 * 拡張せず独立した型・関数にする。
 *
 * 色はMYTHIC（暖色系の虹グラデーション：赤/オレンジ/ティール/青/紫）とは重ならない、
 * 藍〜深い青紫だけの単色相グラデーション（「異質・不穏」寄りのトーン）にし、
 * 解放後も同じ色相のまま（MYTHICの色と被らない）を維持する。
 */
export interface SecretTheme {
  label: 'SECRET'
  lockedBorderClass: string
  lockedBackgroundClass: string
  lockedTextClass: string
  unlockedBorderClass: string
  unlockedBackgroundClass: string
  unlockedTextClass: string
  unlockedGlowClass: string
  unlockedPulseClass: string
}

export function getSecretTheme(): SecretTheme {
  return {
    label: 'SECRET',
    // 未解放: 通常の「暗いrarity色」のどれとも違う、黒に近い藍色＋微かな異質な発光。
    lockedBorderClass: 'border-indigo-950',
    lockedBackgroundClass: 'bg-[#05030f]',
    lockedTextClass: 'text-indigo-300/30',
    // 解放後: 本物の名称・条件を見せつつ、SECRET専用の藍〜紫トーンを維持する
    // （MYTHICの暖色系虹とは別系統）。
    unlockedBorderClass: 'border-indigo-400/50',
    unlockedBackgroundClass: 'bg-[linear-gradient(135deg,#0b0620_0%,#1a0a3a_50%,#0b0620_100%)]',
    unlockedTextClass: 'text-indigo-200',
    unlockedGlowClass: 'shadow-[0_0_20px_rgba(99,102,241,0.45)]',
    unlockedPulseClass: 'anim-rarity-secret-slow',
  }
}
