import { useEffect, useRef, useState } from 'react'
import { NavBar } from '../components/NavBar'
import { TitleDetailModal } from '../components/TitleDetailModal'
import { ACHIEVEMENT_DEFS } from '../config/achievements'
import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getUnlockedAchievements, getUnseenUnlockedAchievementIds, markAllUnlockedAchievementsSeen } from '../utils/achievementStorage'
import { trackTitleEquipped } from '../utils/analytics'
import { equipTitle, getProfile } from '../utils/profileStorage'
import type { AchievementCategory, AchievementId } from '../types'

interface Props {
  onBack: () => void
  onHome: () => void
}

/**
 * Ver.6 Phase 10（実績拡張ラウンド）: 画面表示用のタブ区分。データ上のAchievementCategoryは
 * 7種類（dopa/endless/challenge/worldBattle/friendBattle/special/grind）だが、item 20の
 * ユーザー指示どおり画面幅を考慮してworldBattle/friendBattleは1つの「BATTLE」タブへ統合する
 * （カードごとの個別バッジでどちらのモードかは区別できるようにする）。
 */
type FilterTab = 'all' | 'dopa' | 'endless' | 'challenge' | 'battle' | 'special' | 'grind'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'dopa', label: 'RUSH' },
  { id: 'endless', label: 'ENDLESS' },
  { id: 'challenge', label: 'CHALLENGE' },
  { id: 'battle', label: 'BATTLE' },
  { id: 'special', label: 'SPECIAL' },
  { id: 'grind', label: 'GRIND' },
]

const BATTLE_CATEGORIES: AchievementCategory[] = ['worldBattle', 'friendBattle']

function matchesFilter(category: AchievementCategory, filter: FilterTab): boolean {
  if (filter === 'all') return true
  if (filter === 'battle') return BATTLE_CATEGORIES.includes(category)
  return category === filter
}

const BATTLE_MODE_LABEL: Partial<Record<AchievementCategory, string>> = {
  worldBattle: '世界対戦',
  friendBattle: 'フレンド対戦',
}

/**
 * Ver.6 Phase 5.1（Achievement拡充）→Ver.6 Phase 10（実績拡張ラウンド、68個化）: 実績一覧画面。
 *
 * 68個へ拡充されたため、タブを7種類（ALL＋6カテゴリ）に増やし、横スクロール可能な1行の
 * タブバーにした（2行に折り返さず、画面幅に収まらない分はスワイプで見せる）。カード自体は
 * 既存の2カラムグリッドのまま踏襲する。
 *
 * 解除済み／未解除が一目で分かる表示にし、未解除でも条件（description）は常に見せる
 * （ユーザー指示：条件を隠す必要はない）——ただしsecret指定の実績（鏡写し・大逆転）だけは、
 * 未解除時に名前・条件を「？？？」に隠す（item 12のユーザー指示）。解除済みの行からだけ、
 * 対応するTitleを装備できる（equipTitleが未解除titleIdをガードするため、このUIからは
 * 物理的に未解除Titleを装備できない）。
 *
 * NEW表示（item 19）: この画面をマウントした瞬間の「まだ確認していない解除済み実績」一覧を
 * 1回だけ取得してstateへ固定し（その後にmarkAllUnlockedAchievementsSeenを呼ぶ）、今回の
 * 訪問中はずっとNEWバッジを表示し続け、次回の訪問からは消える——という最も単純で
 * 「ユーザーが気づけること」を優先した方式にした。
 */
export function AchievementScreen({ onBack, onHome }: Props) {
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState<FilterTab>('all')
  // 次フェーズ（item 10）: 実績カードをタップした際に、ProfileScreen.tsxと共通の
  // TitleDetailModalを開く（詳細表示の実装を2重化しない）。
  const [detailId, setDetailId] = useState<AchievementId | null>(null)

  // 次フェーズ（item 19）: タブ行は7個あり390px幅には収まらず横スクロール設計のまま
  // （大規模な再設計はしない——ユーザー指示）。ただし「スクロールできることが分かりにくい」
  // 実機フィードバックに応じ、軽い改善だけを足す——①選択中タブへの自動scrollIntoView、
  // ②右端にフェードを置き「まだ続きがある」ことを視覚的に示す、の2点のみ。
  const tabRowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const active = tabRowRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${filter}"]`)
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [filter])
  const [newIds] = useState<Set<AchievementId>>(() => {
    const unseen = new Set(getUnseenUnlockedAchievementIds())
    markAllUnlockedAchievementsSeen()
    return unseen
  })
  const unlockedMap = getUnlockedAchievements()
  const equippedTitleId = getProfile().equippedTitleId

  const unlockedCount = Object.keys(unlockedMap).length
  const visibleDefs = ACHIEVEMENT_DEFS.filter((d) => matchesFilter(d.category, filter))

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
      <NavBar onBack={onBack} onHome={onHome} />

      <div className="flex flex-1 flex-col items-center gap-3 px-5 py-4">
        <h1 className="text-lg font-black tracking-widest text-white">ACHIEVEMENT</h1>
        <p className="text-xs font-bold tabular-nums text-white/40">
          {unlockedCount} / {ACHIEVEMENT_DEFS.length}
        </p>

        <div className="relative w-full max-w-sm">
          <div
            ref={tabRowRef}
            className="flex gap-1.5 overflow-x-auto rounded-full bg-white/5 p-1 pr-6"
            style={{ scrollbarWidth: 'none' }}
          >
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black tracking-widest transition-colors ${
                  filter === tab.id ? 'bg-fuchsia-500/80 text-white' : 'text-white/45'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* item 19: まだ右に続きがあることを示す薄いフェード（タップ操作には干渉しない）。 */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-full bg-gradient-to-l from-black to-transparent" />
        </div>

        <div key={revision} className="grid w-full max-w-sm grid-cols-2 gap-2">
          {visibleDefs.map((def) => {
            const unlocked = unlockedMap[def.id] !== undefined
            const title = TITLE_DEFS_BY_ID[def.id]
            const isEquipped = equippedTitleId === def.id
            const difficultyTheme = def.endlessDifficulty ? ENDLESS_THEME[def.endlessDifficulty] : null
            const battleModeLabel = BATTLE_MODE_LABEL[def.category]
            const hidden = def.secret && !unlocked
            const isNew = unlocked && newIds.has(def.id)

            return (
              <div
                key={def.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailId(def.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setDetailId(def.id)
                }}
                className={`relative flex flex-col gap-1 rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] ${
                  unlocked
                    ? def.rarity === 'rare'
                      ? 'border border-amber-300/50 bg-gradient-to-b from-amber-400/15 to-fuchsia-500/10'
                      : 'border border-amber-300/30 bg-amber-400/10'
                    : 'border border-white/10 bg-white/[0.03]'
                }`}
              >
                {isNew && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow">
                    NEW
                  </span>
                )}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm" aria-hidden="true">
                    {unlocked ? (def.rarity === 'rare' ? '✨' : '🏆') : '🔒'}
                  </span>
                  {difficultyTheme && (
                    <span className={`shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-black ${difficultyTheme.textClass}`}>
                      {ENDLESS_DIFFICULTY_LABEL[difficultyTheme.id]}
                    </span>
                  )}
                  {battleModeLabel && (
                    <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-black text-white/50">{battleModeLabel}</span>
                  )}
                </div>
                <p className={`text-xs font-black leading-tight ${unlocked ? 'text-amber-200' : 'text-white/50'}`}>
                  {hidden ? '？？？' : def.name}
                </p>
                <p className="text-[10px] leading-snug text-white/40">{hidden ? '？？？' : def.description}</p>
                {unlocked && title && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      handleEquip(title.id, isEquipped)
                    }}
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

      {detailId && <TitleDetailModal achievementId={detailId} unlocked={unlockedMap[detailId] !== undefined} onClose={() => setDetailId(null)} />}
    </div>
  )
}
