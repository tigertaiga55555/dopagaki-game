import type { PassTitleDef } from '../config/passTitles'

interface Props {
  title: PassTitleDef
  onClick?: () => void
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: 「初代ドパガキ」等、PASS限定Titleの専用バッジ。
 * components/TitleBadge.tsx（68個の通常Title、5段階レアリティ）とは視覚的に明確に区別する
 * ——金/雷モチーフで「PASS限定の特別な1個」であることを一目で伝える（ユーザー指示：
 * 視覚的に区別できるようにする）。レアリティ概念（common〜mythic）は持たない
 * （PASS限定Titleはレアリティ系とは別の特別枠のため）。
 */
export function PassTitleBadge({ title, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-amber-400/70 bg-gradient-to-r from-amber-500/25 via-yellow-400/15 to-amber-500/25 px-4 py-1.5 shadow-[0_0_16px_rgba(251,191,36,0.3)] active:scale-95"
    >
      <span aria-hidden="true" className="text-sm">
        ⚡
      </span>
      <span className="text-[9px] font-black tracking-widest text-amber-200/70">PASS限定</span>
      <span className="text-sm font-black text-amber-200">{title.name}</span>
    </button>
  )
}
