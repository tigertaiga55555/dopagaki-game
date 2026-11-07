import { useEffect, useState } from 'react'
import { ACHIEVEMENT_DEFS_BY_ID } from '../config/achievements'
import { trackAchievementUnlock } from '../utils/analytics'
import type { AchievementId } from '../types'

const ACHIEVEMENT_BANNER_MS = 3200

interface Props {
  newlyUnlocked: AchievementId[]
}

/**
 * Ver.6 Phase 5.1（Achievement拡充）: 実績解除バナー。ResultScreen.tsx専用だった同等JSXを
 * 共通化し、EndlessResultScreen.tsxからも使う（Endless STREAK実績もこのバナーで通知する）。
 * ゲーム進行を一切止めない短い自動消去バナーで、GA4のachievement_unlockも表示開始時に
 * 一度だけ送信する。
 */
export function AchievementUnlockBanner({ newlyUnlocked }: Props) {
  const [visible, setVisible] = useState(newlyUnlocked.length > 0)

  useEffect(() => {
    if (newlyUnlocked.length === 0) return
    for (const id of newlyUnlocked) trackAchievementUnlock(id)
    const timer = setTimeout(() => setVisible(false), ACHIEVEMENT_BANNER_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible || newlyUnlocked.length === 0) return null

  return (
    <div className="anim-pop flex w-full max-w-xs flex-col items-center gap-0.5 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-center">
      <p className="text-[10px] font-black tracking-[0.2em] text-amber-300">ACHIEVEMENT UNLOCKED</p>
      {newlyUnlocked.map((id) => (
        <p key={id} className="text-sm font-black text-white">
          {ACHIEVEMENT_DEFS_BY_ID[id].name}
        </p>
      ))}
    </div>
  )
}
