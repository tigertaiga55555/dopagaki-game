import type { ReactNode } from 'react'
import { ShapeIcon, type ShapeId } from './ShapeIcon'

/**
 * 500%チャレンジの図形グループ系問題（ShapeCountPickQuestion/InsideOutsideCountPickQuestion/
 * ExcludePickQuestion）に共通の、選択肢エリアのレイアウトルール。
 *
 * 修正前は各問題が個別にjustify-between/items-start/grid-cols-3のオートプレースメント内に
 * サイズの違うネストgridを置く、といった組み方をしていたため、
 * ・選択肢全体が画面の左下に寄る
 * ・内側/外側ゾーンの枠が他の選択肢より縦に伸びてQAパネルと重なる
 * ・図形の個数（2〜7個）によってボタンの高さがバラつき、下段が画面下に食い込む
 * という表示崩れが問題タイプ・tierの組み合わせによって発生していた。
 *
 * ここでは「常に中央揃え・固定max-width・固定ボタンサイズ」という共通ルールに統一し、
 * 各問題側は個別にposition/widthを指定しないようにする。ゲームロジック・選択肢数・
 * 正誤判定には一切触れない、純粋な表示コンポーネント群。
 */

/** 単一グリッド（tier1のような「全選択肢が同じ並び」のケース、ExcludePickの複数タップ問題）。 */
export function ShapeOptionsGrid({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <div
      className="mx-auto grid w-full max-w-xs justify-items-center gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}

/**
 * 左右／内外のように「2つの領域を見比べる」ケース専用の2カラムレイアウト。
 * 常にitems-center・justify-centerで組むため、片方の領域（内側ゾーンの枠など）が
 * 他方より縦に伸びても、全体としては常に画面中央基準で揃う（旧実装のgrid-cols-3
 * オートプレースメントのような、意図しない左寄せ・下寄せは起きない）。
 */
export function ShapeOptionsTwoColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-6">
      <div className="flex flex-1 flex-col items-center gap-2.5">{left}</div>
      <div className="flex flex-1 flex-col items-center gap-2.5">{right}</div>
    </div>
  )
}

const GROUP_BUTTON_CLASS = 'flex h-16 w-24 flex-wrap content-center items-center justify-center gap-1 rounded-2xl p-1.5 active:scale-90'

/**
 * 図形グループ（複数個の図形をまとめて数える対象）1つ分のボタン。
 * 個数が2〜7個程度の間で変わっても箱の高さ・幅は固定したまま変えない
 * （flex-wrap + content-centerで、折り返した後の中身を箱の中央に収める）。
 * これにより「個数が多い選択肢だけ背が高くなって段がズレる」ことを構造的に防ぐ。
 */
export function ShapeGroupButton({
  icons,
  iconSize = 15,
  onPointerDown,
  selected = false,
}: {
  icons: ShapeId[]
  iconSize?: number
  onPointerDown: () => void
  selected?: boolean
}) {
  return (
    <button onPointerDown={onPointerDown} className={`${GROUP_BUTTON_CLASS} ${selected ? 'bg-white/30' : 'bg-white/10'}`}>
      {icons.map((s, i) => (
        <ShapeIcon key={i} shape={s} size={iconSize} />
      ))}
    </button>
  )
}
