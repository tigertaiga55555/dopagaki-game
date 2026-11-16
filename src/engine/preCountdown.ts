/**
 * Ver.6 Phase 7（ホーム/ENDLESS実機QA最終改善）: 通常モード（useRushGame.ts）が元々
 * 内部に持っていた「START→3・2・1→GO」の開始前カウントダウンの純粋ロジック部分だけを
 * ここへ抽出した。useRushGame.ts側はこのファイルの値をそのまま使うよう書き換え済み
 * （挙動・タイミングは一切変更していない、関数を外出ししただけの安全なリファクタ）。
 * ENDLESSモード（useEndlessGame.ts）は、この同じロジックを使う新しいuseEndlessPreCountdown
 * フックを通じて再利用する——ENDLESS専用にほぼ同じカウントダウンを複製しない、という
 * ユーザー指示に対応するための抽出。
 */
/**
 * Ver.6 Phase 9（実機QA反映・設計メモ、今回は実装しない）: 将来のDOPA HEART消費タイミングの
 * 設計前提。「STARTボタンを押した瞬間」ではなく、このカウントダウンが実際に進み始める瞬間
 * （elapsedMs=0、すなわちこのファイルのpreCountdownValueAtが初めて呼ばれる基準点）を
 * HEART消費のトリガーにする想定。カウントダウン開始後は、途中でやめる／離脱する／ブラウザを
 * 閉じてもHEARTの返却はしない。カウントダウンが始まる前（START押下直後の準備段階）までは、
 * まだ外に戻れる余地を残すUIにする。今回のラウンドではHEART自体の実処理コードは一切追加しない
 * （useRushGame.ts・usePreCountdown.tsの各呼び出し箇所に、同じ前提を指す短いコメントのみ
 * 置いている）。
 */
export const PRE_COUNTDOWN_MS = 1800

/** elapsedMsが経過した時点でのカウントダウン表示値（3/2/1）。1800ms経過後はnull（GOの合図）。 */
export function preCountdownValueAt(elapsedMs: number): number | null {
  const remaining = Math.max(0, PRE_COUNTDOWN_MS - elapsedMs)
  if (remaining <= 0) return null
  if (remaining > 1200) return 3
  if (remaining > 600) return 2
  return 1
}
