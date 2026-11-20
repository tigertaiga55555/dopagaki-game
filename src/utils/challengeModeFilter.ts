/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 14/15）: 「作成したChallenge」
 * 「参加したChallenge」両一覧画面で共有するALL/通常/ENDLESSフィルター。
 *
 * D1側のデータ・履歴保持件数は一切変更しないクライアント側のみの表示フィルターのため、
 * ここでは「一覧（Summary配列）を受け取って絞り込む」ための純粋関数だけを持つ
 * （DOM/Reactに依存しないため、既存のheartDisplay.ts等と同じ方針で直接vitest検証できる）。
 *
 * 通常（NORMAL）= DOPA RUSH系（normal/finalTrial/challenge500）をまとめて1タブとする
 * （ユーザー指示：「通常＝DOPA-RUSH系Challengeのみ」）。ENDLESS = endlessモードのみ。
 */
export type ChallengeModeFilter = 'all' | 'normal' | 'endless'

export const CHALLENGE_MODE_FILTERS: { id: ChallengeModeFilter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'normal', label: 'NORMAL' },
  { id: 'endless', label: 'ENDLESS' },
]

export function matchesChallengeModeFilter(mode: 'normal' | 'finalTrial' | 'challenge500' | 'endless', filter: ChallengeModeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'endless') return mode === 'endless'
  return mode !== 'endless'
}
