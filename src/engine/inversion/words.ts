/**
 * Ver.6 Phase 1: 200〜499%「下線反転」ギミックで使用可能な反転語ペアの一覧。
 * 自然な反対語として成立するものだけを登録する。
 *
 * 重要：このリストを無条件に全問題タイプへ機械適用しない。どの軸をどの問題タイプで
 * 使ってよいかは、各問題テンプレート側（src/questions/endless/*）が個別に
 * ホワイトリスト管理する（このファイルは「存在する反転語」を定義するだけで、
 * 「どこで使えるか」には関与しない）。
 */
export type InversionAxis =
  | 'leftRight'
  | 'upDown'
  | 'bigSmall'
  | 'manyFew'
  | 'longShort'
  | 'nearFar'
  | 'firstLast'
  | 'insideOutside'
  | 'sameDifferent'

export const INVERSION_PAIRS: Record<InversionAxis, readonly [string, string]> = {
  leftRight: ['左', '右'],
  upDown: ['上', '下'],
  bigSmall: ['大きい', '小さい'],
  manyFew: ['多い', '少ない'],
  longShort: ['長い', '短い'],
  nearFar: ['近い', '遠い'],
  firstLast: ['最初', '最後'],
  insideOutside: ['内側', '外側'],
  sameDifferent: ['同じ', '異なる'],
}

/** axisの反対語を返す。wordがそのaxisに属さない場合は例外にする（生成ミスを早期発見するため）。 */
export function opposite(axis: InversionAxis, word: string): string {
  const [a, b] = INVERSION_PAIRS[axis]
  if (word === a) return b
  if (word === b) return a
  throw new Error(`word "${word}" is not a member of inversion axis "${axis}"`)
}

/** axisの2語のうち、ランダムに一方を返す。 */
export function pickAxisWord(axis: InversionAxis): string {
  const [a, b] = INVERSION_PAIRS[axis]
  return Math.random() < 0.5 ? a : b
}
