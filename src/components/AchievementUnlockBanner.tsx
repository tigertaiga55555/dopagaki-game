import { useEffect, useState } from 'react'
import { ACHIEVEMENT_DEFS_BY_ID } from '../config/achievements'
import { getSecretTheme, getTitleRarityTheme } from '../config/titleRarityTheme'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { trackAchievementUnlock } from '../utils/analytics'
import { sfx } from '../utils/sound'
import type { AchievementId, TitleRarity } from '../types'

/**
 * 次フェーズ（item 123-124、リリース前最終デザインラウンド）: rarity（5段階）ごとの
 * 表示時間。「1〜2秒程度でテンポを壊さない」というユーザー指示を守りつつ、高rarityほど
 * わずかに長く見せる程度の差に留める（旧実装のRARE=3.6秒は長すぎたため、このラウンドで
 * 短縮した——rarity差があることが分かる程度で十分）。
 */
const RARITY_DISPLAY_MS: Record<TitleRarity, number> = {
  common: 1300,
  rare: 1500,
  epic: 1700,
  legendary: 2000,
  mythic: 2200,
}
const SECRET_DISPLAY_MS = 2200
/** item 17: 4個以上は1個ずつ長時間表示せず、まとめて1枚のカードで表示する。 */
const SUMMARY_THRESHOLD = 4
const SUMMARY_DISPLAY_MS = 1800

interface Props {
  newlyUnlocked: AchievementId[]
}

/**
 * Ver.6 Phase 5.1（Achievement拡充）→Ver.6 Phase 10（実績拡張ラウンド、解除演出強化）→
 * ゲーム機能クローズラウンド（item 123-124、リリース前最終デザインラウンド）: 実績解除
 * バナー。ResultScreen.tsx・EndlessResultScreen.tsx・ChallengeResultScreen.tsx・
 * ChallengeSentScreen.tsx・SentChallengesScreen.tsx・BattleResultScreen.tsxのResult/完了系
 * 画面専用（＝回答中には絶対に呼ばれない）。
 *
 * 1〜3個: 1枚ずつ順番にカードを切り替えて表示する（同時に全部出さない）。
 * 4個以上: 「実績を{n}個解除！」の1枚のサマリーカードにまとめる（item 17のユーザー指示）。
 *
 * 次フェーズ（item 123-124）: 従来の「rare（AchievementDef.rarity==='rare'、7個だけの
 * 特別フラグ）かどうか」の二択だった演出を、実際のTitle rarity（5段階、COMMON〜MYTHIC）＋
 * SECRET（鏡写し・大逆転等、rarity体系とは別物）で出し分けるよう全面的に書き換えた。
 * 色はconfig/titleRarityTheme.tsの単一定義（AchievementScreen.tsx等と同じ）を再利用する
 * ——演出ロジックをここに重複実装しない。GA4のachievement_unlockは表示開始時に一度だけ
 * 全件送信する（この挙動は変更していない）。
 */
export function AchievementUnlockBanner({ newlyUnlocked }: Props) {
  useEffect(() => {
    if (newlyUnlocked.length === 0) return
    for (const id of newlyUnlocked) trackAchievementUnlock(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (newlyUnlocked.length === 0) return null
  if (newlyUnlocked.length >= SUMMARY_THRESHOLD) return <SummaryCard count={newlyUnlocked.length} />
  return <SequentialCards ids={newlyUnlocked} />
}

function SequentialCards({ ids }: { ids: AchievementId[] }) {
  const [index, setIndex] = useState(0)
  const current = ids[index]
  const def = current ? ACHIEVEMENT_DEFS_BY_ID[current] : null
  const title = current ? TITLE_DEFS_BY_ID[current] : null
  const isSecret = def?.secret === true
  const rarity = !isSecret ? title?.rarity : undefined
  const displayMs = isSecret ? SECRET_DISPLAY_MS : rarity ? RARITY_DISPLAY_MS[rarity] : RARITY_DISPLAY_MS.common

  useEffect(() => {
    if (!def) return
    if (isSecret) sfx.achievementUnlockRare()
    else if (rarity === 'legendary' || rarity === 'mythic') sfx.achievementUnlockRare()
    else sfx.achievementUnlock()
    const timer = setTimeout(() => setIndex((i) => i + 1), displayMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (!def) return null
  return <UnlockCard key={current} name={def.name} rarity={rarity} isSecret={isSecret} />
}

function SummaryCard({ count }: { count: number }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    sfx.achievementUnlock()
    const timer = setTimeout(() => setVisible(false), SUMMARY_DISPLAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div className="anim-pop relative flex w-full max-w-xs flex-col items-center gap-0.5 overflow-hidden rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-2.5 text-center">
      <p className="text-[10px] font-black tracking-[0.2em] text-amber-300">ACHIEVEMENT UNLOCKED</p>
      <p className="text-base font-black text-white">実績を{count}個解除！</p>
      <p className="text-[10px] font-bold text-white/40">Achievement画面で確認できます</p>
    </div>
  )
}

const PARTICLE_POSITIONS = [8, 24, 50, 76, 92]

function UnlockCard({ name, rarity, isSecret }: { name: string; rarity: TitleRarity | undefined; isSecret: boolean }) {
  if (isSecret) {
    const theme = getSecretTheme()
    return (
      <div
        className={`anim-pop relative flex w-full max-w-xs flex-col items-center gap-0.5 overflow-hidden rounded-2xl border px-4 py-3 text-center ${theme.unlockedBorderClass} ${theme.unlockedBackgroundClass} ${theme.unlockedGlowClass} ${theme.unlockedPulseClass}`}
      >
        <p className="relative text-[10px] font-black tracking-[0.2em] text-indigo-200">？？？ SECRET UNLOCKED ？？？</p>
        <p className="relative text-base font-black text-white">{name}</p>
        <p className="relative text-[10px] font-bold text-indigo-200/70">隠された称号を獲得！</p>
      </div>
    )
  }

  if (!rarity || rarity === 'common') {
    const theme = rarity ? getTitleRarityTheme(rarity) : null
    return (
      <div
        className={`anim-pop flex w-full max-w-xs flex-col items-center gap-0.5 rounded-2xl border px-4 py-2 text-center ${theme?.badgeBorderClass ?? 'border-amber-300/40'} ${theme?.badgeBackgroundClass ?? 'bg-amber-400/10'}`}
      >
        <p className="text-[10px] font-black tracking-[0.2em] text-amber-300">ACHIEVEMENT UNLOCKED</p>
        <p className="text-sm font-black text-white">{name}</p>
        <p className="text-[10px] font-bold text-white/40">称号を獲得！</p>
      </div>
    )
  }

  const theme = getTitleRarityTheme(rarity)
  const isHighRarity = rarity === 'legendary' || rarity === 'mythic'

  return (
    <div
      className={`anim-pop relative flex w-full max-w-xs flex-col items-center gap-0.5 overflow-hidden rounded-2xl border px-4 py-3 text-center ${theme.badgeBorderClass} ${theme.badgeBackgroundClass} ${theme.badgeGlowClass} ${theme.badgePulseClass}`}
    >
      {isHighRarity && <div className="anim-gold-burst pointer-events-none absolute h-28 w-28 rounded-full bg-amber-300/50 blur-2xl" />}
      {(rarity === 'epic' || isHighRarity) &&
        PARTICLE_POSITIONS.map((x, i) => (
          <span
            key={i}
            className="anim-particle pointer-events-none absolute bottom-1 text-sm"
            style={{ left: `${x}%`, animationDelay: `${i * 0.15}s` }}
          >
            ✦
          </span>
        ))}
      <p className={`relative text-[10px] font-black tracking-[0.2em] ${theme.badgeTextClass}`}>{theme.label} ACHIEVEMENT</p>
      <p className="relative text-base font-black text-white">{name}</p>
      <p className="relative text-[10px] font-bold text-white/60">称号を獲得！</p>
    </div>
  )
}
