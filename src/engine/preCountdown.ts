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
 * 次フェーズ（DOPA HEART本実装）: DOPA HEART消費タイミングの実装基準点。
 * 「STARTボタンを押した瞬間」ではなく、このカウントダウンが実際に進み始める瞬間
 * （elapsedMs=0、すなわちこのファイルのpreCountdownValueAtが初めて呼ばれる基準点）で
 * HEARTを消費する（実際の消費コードはPlayScreen.tsx/EndlessPlayScreen.tsx側、
 * utils/heartRepository.ts参照）。カウントダウン開始後は、途中でやめる／離脱する／
 * ブラウザを閉じてもHEARTの返却はしない。カウントダウンが始まる前（ENDLESS上級の
 * ルール説明画面等、まだこのカウントダウンが始まっていない段階）までは、誤タップしても
 * 戻れる余地が構造的に残る（usePreCountdownのenabledがまだfalseのため）。
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
