import { useEffect, useState } from 'react'
import { ACHIEVEMENT_DEFS_BY_ID } from '../config/achievements'
import { trackAchievementUnlock } from '../utils/analytics'
import { sfx } from '../utils/sound'
import type { AchievementId } from '../types'

const NORMAL_DISPLAY_MS = 2600
const RARE_DISPLAY_MS = 3600
/** item 17: 4個以上は1個ずつ長時間表示せず、まとめて1枚のカードで表示する。 */
const SUMMARY_THRESHOLD = 4
const SUMMARY_DISPLAY_MS = 3200

interface Props {
  newlyUnlocked: AchievementId[]
}

/**
 * Ver.6 Phase 5.1（Achievement拡充）→Ver.6 Phase 10（実績拡張ラウンド、解除演出強化）:
 * 実績解除バナー。ResultScreen.tsx・EndlessResultScreen.tsx・ChallengeResultScreen.tsx・
 * ChallengeSentScreen.tsx・SentChallengesScreen.tsx・BattleResultScreen.tsxのResult/完了系
 * 画面専用（＝回答中には絶対に呼ばれない）。
 *
 * 1〜3個: 1枚ずつ順番にカードを切り替えて表示する（同時に全部出さない）。
 * 4個以上: 「実績を{n}個解除！」の1枚のサマリーカードにまとめる（item 17のユーザー指示）。
 * レア実績（config/achievements.tsのrarity==='rare'）はより強い演出（gold glow＋sparkle）と
 * 専用SE・やや長い表示時間にする。GA4のachievement_unlockは表示開始時に一度だけ全件送信する。
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
  const isRare = def?.rarity === 'rare'

  useEffect(() => {
    if (!def) return
    if (isRare) sfx.achievementUnlockRare()
    else sfx.achievementUnlock()
    const timer = setTimeout(() => setIndex((i) => i + 1), isRare ? RARE_DISPLAY_MS : NORMAL_DISPLAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (!def) return null
  return <UnlockCard key={current} name={def.name} rare={isRare} />
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

function UnlockCard({ name, rare }: { name: string; rare: boolean }) {
  if (!rare) {
    return (
      <div className="anim-pop flex w-full max-w-xs flex-col items-center gap-0.5 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-center">
        <p className="text-[10px] font-black tracking-[0.2em] text-amber-300">ACHIEVEMENT UNLOCKED</p>
        <p className="text-sm font-black text-white">{name}</p>
        <p className="text-[10px] font-bold text-white/40">称号を獲得！</p>
      </div>
    )
  }

  const particlePositions = [8, 24, 50, 76, 92]
  return (
    <div className="anim-pop relative flex w-full max-w-xs flex-col items-center gap-0.5 overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-b from-amber-400/25 via-fuchsia-500/15 to-amber-400/25 px-4 py-3 text-center shadow-[0_0_28px_rgba(250,204,21,0.55)]">
      <div className="anim-gold-burst pointer-events-none absolute h-28 w-28 rounded-full bg-amber-300/50 blur-2xl" />
      {particlePositions.map((x, i) => (
        <span
          key={i}
          className="anim-particle pointer-events-none absolute bottom-1 text-sm"
          style={{ left: `${x}%`, animationDelay: `${i * 0.15}s` }}
        >
          ✦
        </span>
      ))}
      <p className="relative text-[10px] font-black tracking-[0.2em] text-amber-200 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">
        ✨ RARE ACHIEVEMENT ✨
      </p>
      <p className="relative text-base font-black text-white drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">{name}</p>
      <p className="relative text-[10px] font-bold text-amber-100/80">称号を獲得！</p>
    </div>
  )
}
