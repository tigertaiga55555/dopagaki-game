import { useEffect, useState } from 'react'

interface Props {
  onComplete: () => void
  onCancel: () => void
}

const WATCH_SECONDS = 3

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: リワード広告のモック表示。実広告ネットワークは
 * 今回も接続しない（ADS_ENABLED_V6=false、前ラウンドの決定を維持）——視聴完了を
 * シミュレートするためだけの最小UI。視聴完了までキャンセルできない（実際のリワード広告の
 * 挙動に合わせる）が、QA/実機検証の都合上、完了後は呼び出し元が即座にHeartを+1する。
 */
export function MockRewardedAd({ onComplete, onCancel }: Props) {
  const [remaining, setRemaining] = useState(WATCH_SECONDS)

  useEffect(() => {
    if (remaining <= 0) {
      onComplete()
      return
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining, onComplete])

  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black px-6 text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">広告（QAモック）</p>
      <p className="mb-6 text-5xl font-black tabular-nums text-amber-300">{remaining}</p>
      <p className="mb-8 text-sm font-bold text-white/60">視聴完了後に +1 Heart</p>
      <button onClick={onCancel} className="text-xs font-bold text-white/30 underline">
        キャンセル（QA操作）
      </button>
    </div>
  )
}
