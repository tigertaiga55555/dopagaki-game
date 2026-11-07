import { useState } from 'react'
import { BackButton } from '../components/BackButton'
import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getUnlockedAchievements } from '../utils/achievementStorage'
import { trackTitleEquipped } from '../utils/analytics'
import { equipTitle, getProfile } from '../utils/profileStorage'
import type { AchievementCategory } from '../types'

interface Props {
  onBack: () => void
}

type FilterTab = 'all' | AchievementCategory

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'dopa', label: 'DOPA' },
  { id: 'endless', label: 'ENDLESS' },
]

/**
 * Ver.6 Phase 5.1（Achievement拡充）: 実績一覧画面。
 *
 * 24個へ拡充されたため、単純な縦積みリストではスクロールが長くなりすぎる
 * （ユーザー指示：一覧性を保つこと）。ALL/DOPA/ENDLESSのカテゴリタブで絞り込み可能にし、
 * カード自体も2カラムグリッドのコンパクト表示へ変更した。Endlessカードには、どの難易度
 * （初級/中級/上級）のAchievementかを示す小さなバッジを直接表示する
 * （config/endlessTheme.tsの既存配色をそのまま流用し、新しい色を増やさない）。
 *
 * 解除済み／未解除が一目で分かる表示にし、未解除でも条件（description）は常に見せる
 * （ユーザー指示：条件を隠す必要はない）。解除済みの行からだけ、対応するTitleを
 * 装備できる（equipTitleが未解除titleIdをガードするため、このUIからは物理的に
 * 未解除Titleを装備できない）。TitleロジックはここではTITLE_DEFS_BY_IDの参照だけに留め、
 * Achievement UI自体にTitle解放ロジックを埋め込まない（ユーザー指示：分離構造を維持）。
 */
export function AchievementScreen({ onBack }: Props) {
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState<FilterTab>('all')
  const unlockedMap = getUnlockedAchievements()
  const equippedTitleId = getProfile().equippedTitleId

  const unlockedCount = Object.keys(unlockedMap).length
  const visibleDefs = filter === 'all' ? ACHIEVEMENT_DEFS : ACHIEVEMENT_DEFS.filter((d) => d.category === filter)

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

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        <h1 className="text-lg font-black tracking-widest text-white">ACHIEVEMENT</h1>
        <p className="text-xs font-bold tabular-nums text-white/40">
          {unlockedCount} / {ACHIEVEMENT_DEFS.length} 解除済み
        </p>

        <div className="flex w-full max-w-sm gap-1.5 rounded-full bg-white/5 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 rounded-full py-1.5 text-[11px] font-black tracking-widest transition-colors ${
                filter === tab.id ? 'bg-fuchsia-500/80 text-white' : 'text-white/45'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div key={revision} className="grid w-full max-w-sm grid-cols-2 gap-2">
          {visibleDefs.map((def) => {
            const unlocked = unlockedMap[def.id] !== undefined
            const title = TITLE_DEFS_BY_ID[def.id]
            const isEquipped = equippedTitleId === def.id
            const difficultyTheme = def.endlessDifficulty ? ENDLESS_THEME[def.endlessDifficulty] : null

            return (
              <div
                key={def.id}
                className={`flex flex-col gap-1 rounded-2xl px-3 py-2.5 ${
                  unlocked ? 'border border-amber-300/30 bg-amber-400/10' : 'border border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm" aria-hidden="true">
                    {unlocked ? '🏆' : '🔒'}
                  </span>
                  {difficultyTheme && (
                    <span className={`shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-black ${difficultyTheme.textClass}`}>
                      {ENDLESS_DIFFICULTY_LABEL[difficultyTheme.id]}
                    </span>
                  )}
                </div>
                <p className={`text-xs font-black leading-tight ${unlocked ? 'text-amber-200' : 'text-white/50'}`}>{def.name}</p>
                <p className="text-[10px] leading-snug text-white/40">{def.description}</p>
                {unlocked && title && (
                  <button
                    onClick={() => handleEquip(title.id, isEquipped)}
                    className={`mt-1 rounded-full px-2 py-1 text-[10px] font-bold active:scale-95 ${
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
