import { useState } from 'react'
import { BackButton } from '../components/BackButton'
import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getUnlockedAchievements } from '../utils/achievementStorage'
import { trackTitleEquipped } from '../utils/analytics'
import { equipTitle, getProfile } from '../utils/profileStorage'

interface Props {
  onBack: () => void
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: 実績一覧画面。
 *
 * 解除済み／未解除が一目で分かる表示にし、未解除でも条件（description）は常に見せる
 * （ユーザー指示：条件を隠す必要はない）。解除済みの行からだけ、対応するTitleを
 * 装備できる（equipTitleが未解除titleIdをガードするため、このUIからは物理的に
 * 未解除Titleを装備できない）。
 */
export function AchievementScreen({ onBack }: Props) {
  const [revision, setRevision] = useState(0)
  const unlockedMap = getUnlockedAchievements()
  const equippedTitleId = getProfile().equippedTitleId

  function handleEquip(titleId: string, alreadyEquipped: boolean) {
    const next = alreadyEquipped ? null : titleId
    const result = equipTitle(next)
    if (result.ok) {
      trackTitleEquipped(next)
      setRevision((r) => r + 1)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={onBack} label="戻る" />

      <div className="flex flex-1 flex-col items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-white">ACHIEVEMENT</h1>
        <p className="text-xs font-bold text-white/40">{Object.keys(unlockedMap).length} / {ACHIEVEMENT_DEFS.length} 解除済み</p>

        <div key={revision} className="flex w-full max-w-xs flex-col gap-2.5">
          {ACHIEVEMENT_DEFS.map((def) => {
            const unlocked = unlockedMap[def.id] !== undefined
            const title = TITLE_DEFS_BY_ID[def.id]
            const isEquipped = equippedTitleId === def.id
            return (
              <div
                key={def.id}
                className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                  unlocked ? 'border border-amber-300/30 bg-amber-400/10' : 'border border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base" aria-hidden="true">
                      {unlocked ? '🏆' : '🔒'}
                    </span>
                    <p className={`truncate text-sm font-black ${unlocked ? 'text-amber-200' : 'text-white/50'}`}>{def.name}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">{def.description}</p>
                </div>
                {unlocked && title && (
                  <button
                    onClick={() => handleEquip(title.id, isEquipped)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-95 ${
                      isEquipped ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {isEquipped ? '装備中' : '装備する'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
