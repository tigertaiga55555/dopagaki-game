/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: PASS限定Title。既存の68個（config/titles.ts、
 * common〜mythicの5段階レアリティ）とは完全に別のコレクション——68/68 Achievement
 * 完了率には一切カウントしない、PASS購入という別の解除条件を持つ特別枠（ユーザー指示）。
 *
 * 「初代ドパガキ」は仮称。将来名称を変更する場合は、このファイルのnameフィールド1箇所を
 * 書き換えるだけで済むようにしてある（id自体は変更しない——保存済みの所有判定
 * payment/passTitleGrants.tsがidで比較するため、idを変えると既存の付与記録と
 * 整合しなくなる）。
 */
export interface PassTitleDef {
  id: string
  name: string
  description: string
}

/** 発売キャンペーン期間中にDOPA PASSを購入した人だけに付与される、永久保持の限定Title。 */
export const LAUNCH_CAMPAIGN_PASS_TITLE: PassTitleDef = {
  id: 'pass_launch_campaign',
  name: '初代ドパガキ',
  description: '発売キャンペーン期間中にDOPA PASSを購入した証。一度獲得すれば永久に保持される。',
}

export const PASS_TITLE_DEFS: PassTitleDef[] = [LAUNCH_CAMPAIGN_PASS_TITLE]

export const PASS_TITLE_DEFS_BY_ID: Record<string, PassTitleDef> = Object.fromEntries(PASS_TITLE_DEFS.map((t) => [t.id, t]))
