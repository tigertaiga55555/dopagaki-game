import { useEffect, useRef, useState } from 'react'
import { sfx } from '../utils/sound'
import { preCountdownValueAt } from './preCountdown'

interface Options {
  /** trueになった瞬間にカウントダウンを開始する。falseの間は何もしない。 */
  enabled: boolean
  /** カウントダウンが終わった（GOの合図）瞬間に1回だけ呼ばれる。 */
  onDone: () => void
}

/**
 * Ver.6 Phase 7（ENDLESSに3→2→1→STARTを追加）: 通常モード（useRushGame.ts）の
 * START→3・2・1→GO演出と同じタイミング定数・同じ効果音（engine/preCountdown.ts・
 * utils/sound.tsのsfx.countdownBeep/sfx.gameStart）を使う、独立したカウントダウンフック。
 * useRushGame.ts自身のRAFループには一切触れず、「別の既存エンジン（useEndlessGame.ts）の
 * 開始を、まず少しだけ遅らせたい」という用途向けに新設した——ENDLESS専用にほぼ同じ
 * カウントダウンを複製しない、というユーザー指示に対応するための共通化。
 *
 * 返り値（3/2/1/null）をそのまま画面側の表示に使う。nullになった最初のタイミングで
 * onDoneが呼ばれるので、呼び出し側はそこで実際のゲーム開始（useEndlessGame().start()等）を
 * 行えば、「カウントダウン中は問題のタイマーが進まない」が自然に保証される。
 */
export function usePreCountdown({ enabled, onDone }: Options): number | null {
  const [value, setValue] = useState<number | null>(3)
  const startRef = useRef<number | null>(null)
  const lastBeepRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    let raf: number

    function tick() {
      const now = performance.now()
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const next = preCountdownValueAt(elapsed)
      setValue(next)
      if (next !== null && next !== lastBeepRef.current) {
        lastBeepRef.current = next
        sfx.countdownBeep(next)
      }
      if (next === null) {
        if (!doneRef.current) {
          doneRef.current = true
          sfx.gameStart()
          onDone()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return value
}
