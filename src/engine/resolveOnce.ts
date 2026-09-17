/**
 * Ver.4.8: 各QuestionModuleのSUCCESS/MISSを「最大1回」だけ確定させるための共通ガード。
 * これまでは各問題ファイルが個別に doneRef（真偽値のref）＋ if (doneRef.current) return
 * という同じパターンを手書きしていた。動作としては正しかったが、書き忘れると即座に
 * 二重確定（タイマーとpointerupが両方成立するなど）のバグになる危険なパターンだったため、
 * 共通ユーティリティとして1箇所にまとめる。
 *
 * 汎用タイムアウト・setInterval・requestAnimationFrame・pointerup/pointercancel・click、
 * どの経路から呼ばれても、最初の1回だけがonResultに届き、以降は黙って無視される。
 */
export interface ResolveOnceGuard<T> {
  readonly isResolved: boolean
  resolve(result: T): void
}

export function createResolveOnce<T>(onResolve: (result: T) => void): ResolveOnceGuard<T> {
  let resolved = false
  return {
    get isResolved() {
      return resolved
    },
    resolve(result: T) {
      if (resolved) return
      resolved = true
      onResolve(result)
    },
  }
}
