import { useEffect, useState } from 'react'

/**
 * Ver.6 Phase 1: リアクションタイム計測修正の一環。
 * 問題が実際にブラウザへペイントされる前（マウント直後〜次のフレームまで）は
 * falseを返す。この間に届いたpointer入力を透明なオーバーレイ等で吸収することで、
 * 「前の問題への入力直後に発生したバウンス/残留タップが、即座にマウントされた
 * 次の問題の正解要素にそのまま命中し、ほぼ0msの反応時間として記録されてしまう」
 * 経路を塞ぐ。判定は二重requestAnimationFrameで行い、useQuestionStartRefの
 * 計測開始タイミングと常に一致させる。
 */
export function useInputGateReady(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [])

  return ready
}
