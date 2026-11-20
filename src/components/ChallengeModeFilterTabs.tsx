import { CHALLENGE_MODE_FILTERS, type ChallengeModeFilter } from '../utils/challengeModeFilter'

interface Props {
  value: ChallengeModeFilter
  onChange: (value: ChallengeModeFilter) => void
}

/**
 * 次フェーズ（item 14/15/16）: 「作成したChallenge」「参加したChallenge」両画面で共有する
 * フィルタータブ。AchievementScreen.tsxのタブ（rounded-full bg-white/5 p-1、アクティブ
 * 時bg-fuchsia-500/80）と同じ配色・形状に揃える（item 16のユーザー指示）。
 * タブは3つだけ（ALL/NORMAL/ENDLESS）のため、Achievement画面の7タブと違い横スクロール
 * なしのflex-1等幅で390px幅に収まる（はみ出し・見切れが発生しない）。
 */
export function ChallengeModeFilterTabs({ value, onChange }: Props) {
  return (
    <div className="flex w-full max-w-sm gap-1.5 rounded-full bg-white/5 p-1">
      {CHALLENGE_MODE_FILTERS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-full px-2 py-1.5 text-[10px] font-black tracking-widest transition-colors ${
            value === tab.id ? 'bg-fuchsia-500/80 text-white' : 'text-white/45'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
