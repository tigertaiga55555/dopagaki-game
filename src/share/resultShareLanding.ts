export type ShareLandingDestination = { kind: 'web' } | { kind: 'app-store'; url: string }

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: 結果シェアURL（/s/:id）を開いた
 * 瞬間に「どこへ連れて行くか」を決める、唯一の差し込み点。
 *
 * 今回のラウンドではApp Store URLがまだ存在しない（本番未リリース）ため、常に{kind:'web'}
 * を返し、既存のWeb結果表示（screens/ResultShareLandingScreen.tsx）へそのままフォール
 * スルーする。iOS化・Universal Links・App Store誘導を実装する際は、この関数の中身
 * （utils/platform.tsの既存isIOS()判定 ＋ アプリ既にインストール済みかの判定を足して、
 * 条件を満たせば{kind:'app-store', url: 実際のApp Store URL}を返す）だけを書き換えれば
 * よく、呼び出し側（App.tsx・ResultShareLandingScreen.tsx）は一切変更不要になるよう
 * 設計している——新しい判定ロジックをここに作る必要はなく、既存のisIOS()をそのまま
 * 再利用できる形にしてある。
 */
export function resolveShareLandingDestination(): ShareLandingDestination {
  return { kind: 'web' }
}
