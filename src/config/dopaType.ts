/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 104-105）: DOPA RUSHの最終DOPA%に応じた
 * 「DOPA TYPE」名称の単一定義。結果画面（ResultCard.tsx）／Xシェア本文
 * （share/shareResult.ts）／OGP画像（worker/ogImageHtml.ts・worker/ogpCard.ts）／
 * Achievement（config/achievements.ts）／Title（config/titles.ts）のすべてが、
 * この1つの定義（DOPA_TYPE_TIERS・getDopaType）だけを参照する——閾値ロジックを
 * 複数箇所に重複させない。
 *
 * ENDLESS（item 114で確認済み）には一切適用しない——DOPA TYPEはDOPA RUSH専用。
 *
 * 500%は既存Title「真・ドパガキ」（id: dopa500, rarity: mythic）を「ドパガキの神」へ
 * 改名して対応する（新規Achievement/Titleは追加しない）ため、ここでは便宜上
 * 0〜499%の8帯だけを「新規追加対象」として扱い、500%自体もテーブルには含めて
 * getDopaType()が常に単一の定義を参照できるようにする。
 */
export interface DopaTypeTier {
  /** config/achievements.ts・config/titles.tsの新規id接頭辞に使う（500%は既存のdopa500を流用するためここには含めない）。 */
  id: string
  min: number
  max: number
  name: string
}

export const DOPA_TYPE_TIERS: DopaTypeTier[] = [
  { id: 'dopaTypeReason', min: 0, max: 24, name: '理性残存型ドパガキ' },
  { id: 'dopaTypeImpatient', min: 25, max: 49, name: '待てない型ドパガキ' },
  { id: 'dopaTypeReflex', min: 50, max: 79, name: '脳直タップ型ドパガキ' },
  { id: 'dopaTypeWild', min: 80, max: 99, name: '野生型ドパガキ' },
  { id: 'dopaTypeAwakened', min: 100, max: 199, name: '覚醒型ドパガキ' },
  { id: 'dopaTypeAce', min: 200, max: 299, name: 'ドパガキエース' },
  { id: 'dopaTypeLegend', min: 300, max: 399, name: '伝説のドパガキ' },
  { id: 'dopaTypeKing', min: 400, max: 499, name: 'ドパガキ王' },
  // 500%は新規Achievement/Titleを追加せず、既存dopa500（真・ドパガキ→ドパガキの神へ改名）で対応する。
  { id: 'dopa500', min: 500, max: Infinity, name: 'ドパガキの神' },
]

/** 新規追加対象の8帯（500%＝既存dopa500の改名で対応済みのものは除く）。achievements.ts/titles.tsから使う。 */
export const NEW_DOPA_TYPE_TIERS = DOPA_TYPE_TIERS.slice(0, -1)

export function getDopaType(percent: number): DopaTypeTier {
  return DOPA_TYPE_TIERS.find((tier) => percent >= tier.min && percent <= tier.max) ?? DOPA_TYPE_TIERS[DOPA_TYPE_TIERS.length - 1]
}

export function getDopaTypeName(percent: number): string {
  return getDopaType(percent).name
}
