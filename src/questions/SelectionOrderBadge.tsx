const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

interface Props {
  /** 1始まりの順位。10を超える場合は丸数字がないため素の数字表示にフォールバックする。 */
  order: number
}

/**
 * Ver.6 Phase 7（ホーム/ENDLESS実機QA最終改善）: 順番が重要な複数選択問題で、
 * 既に正しくタップした順序を①②③…で示す共通バッジ。親要素（選択肢ボタン）は
 * 必ずposition: relativeであること。押した順番そのものを見せる、という目的のため、
 * 「選んだかどうか」だけでなく「何番目に選んだか」を一目で分かるようにする。
 */
export function SelectionOrderBadge({ order }: Props) {
  const label = CIRCLED_DIGITS[order - 1] ?? String(order)
  return (
    <span
      className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black leading-none text-black shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
      aria-hidden="true"
    >
      {label}
    </span>
  )
}

/**
 * valueが既に正しい順序でタップ済みなら、その1始まりの順位を返す（未タップならnull）。
 * order: 正解の値（またはid）を正しい順序で並べた配列。clearedCount: 現在までに
 * 正しくタップできた数。「order内に存在するが、まだclearedCountに達していない」場合は
 * 未タップ扱いにする（将来tapする番だが、まだタップしていないもの）。
 */
export function sequenceOrderOf(value: number, order: number[], clearedCount: number): number | null {
  const idx = order.indexOf(value)
  if (idx === -1 || idx >= clearedCount) return null
  return idx + 1
}
