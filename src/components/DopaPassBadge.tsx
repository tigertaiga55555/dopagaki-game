interface Props {
  onClick?: () => void
  /** 小さい表示（将来のVS/Ranking/Challenge等、名前の横に添えるだけの用途）。既定はProfile用の大きめ表示。 */
  compact?: boolean
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 30）: 「このアカウントがDOPA PASSを所有している」
 * ことを示す汎用バッジ。X/Twitterの認証チェックマークを模倣しない、独自デザイン
 * （クラウンモチーフ、金色系）——ユーザー指示。装備中Title（PassTitleBadge.tsx、
 * 68個の通常Titleバッジ=TitleBadge.tsx）とは完全に別概念で、どのTitleを装備していても
 * PASS所有者であれば常に表示できる。
 *
 * 再利用コンポーネントとして作る（将来VS/Ranking/Challengeへも表示予定——ただし今回は
 * Profile画面のみで使う。ユーザー自身の仕様文言でも「将来表示可能な共通component」と
 * 明記されており、他画面への配置は今回のスコープ外）。
 */
export function DopaPassBadge({ onClick, compact = false }: Props) {
  if (compact) {
    return (
      <span
        onClick={onClick}
        className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black text-amber-300"
      >
        <span aria-hidden="true">👑</span>
        PASS
      </span>
    )
  }

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/20 to-yellow-400/10 px-3.5 py-1 text-xs font-black text-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.25)] active:scale-95"
    >
      <span aria-hidden="true">👑</span>
      DOPA PASS
    </Tag>
  )
}
