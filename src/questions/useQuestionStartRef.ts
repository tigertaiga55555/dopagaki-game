import { useEffect, useRef } from 'react'

/**
 * Ver.6 Phase 1: useRef(performance.now())の直接置き換え。
 * render実行時点（コミット前・ペイント前）ではなく、実際にブラウザが描画した
 * 次のフレーム（requestAnimationFrameを2回ネストして「ペイント後」を保証する）の
 * 時刻を.currentへ格納する。返り値の形はuseRef(performance.now())と同一
 * （MutableRefObject<number>・.currentへの直接アクセス）なので、各問題コンポーネント側の
 * 「performance.now() - startRef.current」という既存の計算式は一切変更不要。
 *
 * 入力の先行受理防止（前問からのpointer/touch入力の持ち越し拒否）はQuestionShell側の
 * オーバーレイが担当する。両者は同じ二重rAFのタイミングで「見える化」を判定するため、
 * 計測開始点と入力受理開始点は常に一致する。
 */
export function useQuestionStartRef() {
  const ref = useRef(performance.now())
  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        ref.current = performance.now()
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [])
  return ref
}
