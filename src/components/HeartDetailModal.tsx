import { useEffect, useState } from 'react'
import { HEART_CAP, HEART_REGEN_MS, localHeartRepository } from '../utils/heartRepository'
import { formatMmSs } from '../utils/formatTime'
import { HeartIcon } from './HeartIcon'

interface Props {
  onClose: () => void
}

const REGEN_MINUTES = HEART_REGEN_MS / (60 * 1000)

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 5）: Heart表示をタップした際に開く
 * 詳細モーダル。所持数・自然回復上限・回復レート・次回回復までの残り時間のみを表示する
 * （ユーザー指示：動画視聴/購入/DOPA PASSなど未実装の機能ボタンは一切置かない）。
 */
export function HeartDetailModal({ onClose }: Props) {
  const [count, setCount] = useState(() => localHeartRepository.getHeartCount())
  const [etaMs, setEtaMs] = useState(() => localHeartRepository.getNextRecoveryEtaMs())

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(localHeartRepository.getHeartCount())
      setEtaMs(localHeartRepository.getNextRecoveryEtaMs())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-rose-400/30 bg-[#1a0e2e] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-center gap-1">
          <HeartIcon filled size={28} />
          <span className="text-2xl font-black tabular-nums text-white">
            {count} <span className="text-sm font-bold text-white/40">/ {HEART_CAP}</span>
          </span>
        </div>

        <div className="mb-5 space-y-1.5 rounded-2xl bg-white/5 p-3 text-left text-xs font-bold text-white/60">
          <p>自然回復の上限：{HEART_CAP}</p>
          <p>
            回復レート：{REGEN_MINUTES}分で1回復
          </p>
          <p>
            次の回復まで：
            <span className="ml-1 font-black tabular-nums text-rose-300">{etaMs === null ? 'MAX' : formatMmSs(etaMs)}</span>
          </p>
        </div>

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
