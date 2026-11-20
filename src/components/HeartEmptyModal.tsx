import { useEffect, useState } from 'react'
import { formatMmSs } from '../utils/formatTime'

interface Props {
  /** 次の1回復までの残りミリ秒（既に0以上へ回復していた場合に備え、呼び出し元が開く直前の最新値を渡す）。 */
  initialEtaMs: number
  onClose: () => void
}

/**
 * 次フェーズ（DOPA HEART本実装、item 12）: Heart 0でDOPA RUSH/ENDLESSを開始しようとした
 * 際に表示するモーダル。「ハートがありません」「次の回復まで XX:XX」の最小表示のみ。
 *
 * 将来ここへ追加される想定の「動画を見て+1」「購入」「DOPA PASS」ボタンは、今回は
 * 購入・広告・PASSを一切実装しないため、押せる未実装ボタンを置かない
 * （ユーザー指示：自然回復待ちのUIのみで構わない）。
 */
export function HeartEmptyModal({ initialEtaMs, onClose }: Props) {
  const [etaMs, setEtaMs] = useState(initialEtaMs)

  useEffect(() => {
    const interval = setInterval(() => {
      setEtaMs((prev) => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6">
      <div className="anim-pop w-full max-w-xs rounded-3xl border border-rose-400/30 bg-[#1a0e2e] p-6 text-center shadow-2xl">
        <p className="mb-2 text-3xl" aria-hidden="true">
          💔
        </p>
        <h2 className="mb-1 text-lg font-black text-white">ハートがありません</h2>
        <p className="mb-5 text-xs font-bold text-white/50">
          次の回復まで
          <br />
          <span className="text-2xl font-black tabular-nums text-rose-300">{formatMmSs(etaMs)}</span>
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-white/10 py-3 text-sm font-black text-white active:scale-95"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
