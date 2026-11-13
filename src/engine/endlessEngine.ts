/**
 * Ver.6 Phase 4: Endlessモードの純粋な状態遷移ロジック。
 * challenge500Engine.tsと同じ方針で、画面コンポーネントやReactの状態管理から
 * 完全に切り離してある（責務分離・テスト容易性のため、UIに一切依存しない）。
 *
 * 仕様（ユーザー指示）はシンプル: 「何問連続正解できるか」を競うモードで、
 * スコア＝連続正解数（streak）。1 MISS（時間切れ含む）で即終了。DOPA%のような
 * 複雑な加点・ペナルティ・tier・checkpointは一切存在しない。
 */
export interface EndlessState {
  /** 現在の連続正解数。MISS直前まで積み上がった値がそのまま最終スコアになる。 */
  streak: number
  /** 終了したか（1 MISS、時間切れも同じくMISS扱い） */
  ended: boolean
}

export function createEndlessState(): EndlessState {
  return { streak: 0, ended: false }
}

/** 正解1問：streak+1。終了後に呼ばれても状態は変化しない（ended後のno-opガード）。 */
export function applyEndlessCorrect(state: EndlessState): EndlessState {
  if (state.ended) return state
  return { streak: state.streak + 1, ended: false }
}

/**
 * MISS（時間切れも含む）：即終了。streak自体はその時点の値のまま保持する
 * （「12問正解後に13問目でMISS→SCORE 12」という仕様どおり、MISSした問題自体は
 * streakに加算しない）。
 */
export function applyEndlessMiss(state: EndlessState): EndlessState {
  if (state.ended) return state
  return { streak: state.streak, ended: true }
}
