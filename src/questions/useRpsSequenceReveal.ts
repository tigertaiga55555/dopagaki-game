import { useEffect, useRef, useState } from 'react'
import { RPS_BLANK_MS, RPS_HAND_STEP_MS } from '../engine/rpsSequence'

interface Options {
  length: number
  handMs?: number
  blankMs?: number
  /** 3手全ての提示＋最後のblankが終わった瞬間に1回だけ呼ばれる（回答フェーズの開始合図）。 */
  onRevealDone: () => void
}

/**
 * Ver.6 Phase 9（実機QA反映）: じゃんけん連続提示の「表示→消去→blank→次の表示→…→全部完了→
 * blank→回答可能」という状態遷移を一箇所に共通化した薄いフック。
 *
 * 旧実装（FinalRpsForwardSequenceQuestion等）は、各手のreveal用setTimeoutをi*HAND_STEP_MSで
 * 積むだけで、「消去」用のタイマーを持たなかった。そのため次の手が来るまで前の手の絵文字が
 * 画面に残り続け、隣接する手が同じ値だった場合はもちろん、異なる値でも「1枚の静止画が
 * 一瞬だけ切り替わる」ようにしか見えず、「3回はっきり提示された」という体感が得られなかった。
 *
 * ここでは各手ごとに「表示開始」「表示終了（=visibleIndexをnullに戻す＝消去）」の2つの
 * タイマーを積み、消去から次の表示開始までの間（blankMs）は必ずvisibleIndexがnullになる
 * （＝画面上、絵文字が存在しない状態を経由する）ことを保証する。3手目の消去後にも同じ
 * blankを経由してから初めてonRevealDoneを呼ぶため、回答フェーズのタイマーはこの関数の外側
 * （呼び出し元のfailTimer開始処理）で、提示が完全に終わった後にしか始まらない。
 */
export function useRpsSequenceReveal({ length, handMs = RPS_HAND_STEP_MS, blankMs = RPS_BLANK_MS, onRevealDone }: Options) {
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null)
  const [revealDone, setRevealDone] = useState(false)
  const onRevealDoneRef = useRef(onRevealDone)
  onRevealDoneRef.current = onRevealDone

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const stepMs = handMs + blankMs
    for (let i = 0; i < length; i++) {
      timers.push(setTimeout(() => setVisibleIndex(i), i * stepMs))
      timers.push(setTimeout(() => setVisibleIndex(null), i * stepMs + handMs))
    }
    timers.push(
      setTimeout(() => {
        setRevealDone(true)
        onRevealDoneRef.current()
      }, length * stepMs),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { visibleIndex, revealDone }
}
