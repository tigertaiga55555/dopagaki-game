import { useState } from 'react'
import { TITLE_DEFS_BY_ID } from '../config/titles'
import { getTitleRarityTheme } from '../config/titleRarityTheme'
import { MAX_FAVORITE_TITLES } from '../utils/profileStorage'
import type { TitleId } from '../types'

interface Props {
  favoriteTitleIds: TitleId[]
  /** 選択可能なTitle（解除済みのもの）。 */
  unlockedTitleIds: TitleId[]
  onChange: (next: TitleId[]) => void
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 29）: PASS所有者専用の「お気に入りTitle」
 * （装備中Title＝equippedTitleIdとは別、最大MAX_FAVORITE_TITLES個）の表示・編集UI。
 * ProfileScreen.tsxがPASS所有者の時だけこのコンポーネントを描画する（本体側は
 * entitlementを意識しない、呼び出し元が表示自体をガードする既存方針）。
 */
export function FavoriteTitlesRow({ favoriteTitleIds, unlockedTitleIds, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  function toggle(titleId: TitleId) {
    if (favoriteTitleIds.includes(titleId)) {
      onChange(favoriteTitleIds.filter((id) => id !== titleId))
      return
    }
    if (favoriteTitleIds.length >= MAX_FAVORITE_TITLES) return
    onChange([...favoriteTitleIds, titleId])
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black tracking-widest text-amber-300/80">お気に入りTitle（PASS限定機能）</p>
        <button onClick={() => setPickerOpen((v) => !v)} className="text-[10px] font-bold text-white/40 underline">
          {pickerOpen ? '閉じる' : '編集'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {favoriteTitleIds.length === 0 && <p className="text-xs text-white/30">まだ設定されていません</p>}
        {favoriteTitleIds.map((id) => {
          const def = TITLE_DEFS_BY_ID[id]
          if (!def) return null
          const theme = getTitleRarityTheme(def.rarity)
          return (
            <span
              key={id}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${theme.badgeBorderClass} ${theme.badgeBackgroundClass} ${theme.badgeTextClass}`}
            >
              {def.name}
              {pickerOpen && (
                <button onClick={() => toggle(id)} className="ml-0.5 text-white/50" aria-label="お気に入りから外す">
                  ×
                </button>
              )}
            </span>
          )
        })}
      </div>

      {pickerOpen && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-white/5 p-2">
          {unlockedTitleIds.length === 0 && <p className="p-2 text-xs text-white/30">解除済みのTitleがありません</p>}
          {unlockedTitleIds.map((id) => {
            const def = TITLE_DEFS_BY_ID[id]
            if (!def) return null
            const selected = favoriteTitleIds.includes(id)
            const atCap = !selected && favoriteTitleIds.length >= MAX_FAVORITE_TITLES
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={atCap}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold ${
                  selected ? 'bg-amber-500/20 text-amber-200' : atCap ? 'text-white/20' : 'text-white/70 active:bg-white/10'
                }`}
              >
                <span>{def.name}</span>
                {selected && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
