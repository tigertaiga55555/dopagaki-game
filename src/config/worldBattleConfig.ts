/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 81）: 世界対戦のルールセット表示。
 *
 * 世界対戦は発売時点ではNORMAL（DOPA RUSH）ルールのみ（ユーザー指示: マッチング
 * プールを分割しないため、意図的にENDLESS版は作らない）。画面上に「このルールで
 * 対戦する」ことを小さく明示しつつ、将来WORLD ENDLESSを追加する際にこのRecordへ
 * 1行足すだけで済むようにする——ラベル文字列を複数画面へ直書きで貼り付けない。
 */
export type WorldBattleRuleset = 'normal'

/** 現時点で世界対戦が対応する唯一のルールセット。将来WORLD ENDLESSを追加する際、ここを配列化するか、entryポイント単位で切り替える。 */
export const WORLD_BATTLE_RULESET: WorldBattleRuleset = 'normal'

export const WORLD_BATTLE_RULESET_LABEL: Record<WorldBattleRuleset, string> = {
  normal: '対戦ルール: DOPA RUSH',
}
