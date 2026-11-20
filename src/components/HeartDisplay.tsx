import { useEffect, useState } from 'react'
import { HEART_CAP, localHeartRepository } from '../utils/heartRepository'
import { computeHeartSlotsView } from '../utils/heartDisplay'
import { formatMmSs } from '../utils/formatTime'
import { HeartIcon } from './HeartIcon'
import { HeartDetailModal } from './HeartDetailModal'

/** Heart表示の自動更新間隔（回復timerをmm:ssで見せるため、既存の15秒間隔より短く1秒ごとに揃える）。 */
const TICK_MS = 1000

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 1-5）: Home画面のHeart表示を、従来の
 * 「❤️ N / 5」というテキスト表示から、5枠のHeartIcon（塗り/空）＋自然回復上限超過分の
 * 「+N」表示＋次回回復までのライブカウントダウンへ置き換える。
 *
 * - 絵文字ではなくHeartIcon（SVG）を使うことでOS/フォント間の見た目ブレを避ける（item 1）。
 * - DOPA RUSH/ENDLESS/BATTLEのモードカードより視覚的に主張しすぎないよう、文字サイズ・
 *   周囲の余白はモードカード群より控えめに保つ（item 2）。
 * - count < HEART_CAPの間だけ「次の回復まで mm:ss」を表示し、HEART_CAP以上では何も
 *   表示しない（item 3。「MAXまたは何も表示しない」はどちらも許容との指示のため、
 *   より主張が弱い「非表示」を採用）。
 * - タップで詳細モーダル（HeartDetailModal）を開く（item 5）。
 */
export function HeartDisplay() {
  const [count, setCount] = useState(() => localHeartRepository.getHeartCount())
  const [etaMs, setEtaMs] = useState(() => localHeartRepository.getNextRecoveryEtaMs())
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(localHeartRepository.getHeartCount())
      setEtaMs(localHeartRepository.getNextRecoveryEtaMs())
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [])

  const view = computeHeartSlotsView(count, HEART_CAP)

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="flex flex-col items-end gap-0.5 self-end active:opacity-70"
        aria-label={`Heart ${count} / ${HEART_CAP}`}
      >
        <span className="flex items-center gap-0.5">
          {Array.from({ length: view.totalSlots }, (_, index) => (
            <HeartIcon key={index} filled={index < view.filledSlots} size={20} />
          ))}
          {view.overflow > 0 && <span className="ml-0.5 text-sm font-black tabular-nums text-rose-300">+{view.overflow}</span>}
        </span>
        {view.showRecoveryTimer && etaMs !== null && (
          <span className="text-[11px] font-bold tabular-nums text-white/40">
            次の回復まで {formatMmSs(etaMs)}
          </span>
        )}
      </button>
      {showDetail && <HeartDetailModal onClose={() => setShowDetail(false)} />}
    </>
  )
}
