import { useEffect, useState } from 'react'
import { HEART_CAP, localHeartRepository } from '../utils/heartRepository'
import { computeHeartSlotsView, isHeartSlotFilledAt } from '../utils/heartDisplay'
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
 *
 * 次フェーズ（DOPA PASS基盤ラウンド）: `unlimited`がtrueの間（DOPA PASS所有者）は、
 * 5枠表示の代わりに「∞ HEART / DOPA PASS」の1行表示に切り替える——無料ユーザーの
 * Heartロジック・表示自体は一切変更しない（unlimited=falseの分岐は従来のまま）。
 *
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 35）: ①ハート列の右側に明示的な「＋」affordance
 * を追加した（既存の「ハート自体をタップ」でも同じ詳細モーダルが開く挙動は維持しつつ、
 * 「＋」を一次的な見た目のaffordanceにする、というユーザー指示）。DOPA RUSH等の一次CTA
 * （rounded-2xl・py-4以上の大ボタン）より明確に控えめなサイズ（24px角丸circle・text-xs）に
 * 留める。②5枠超過時の「+N」オーバーフローバッジ（既存、琥珀/rose系の数字バッジ）とは
 * 色・形の両方で混同しないよう、この「＋」はニュートラルな白系の丸ボタンにする。
 * ③空枠は左・満枠は右（isHeartSlotFilledAt、heartDisplay.ts側の純粋関数）。
 */
export function HeartDisplay({ unlimited = false }: { unlimited?: boolean }) {
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
      <div className="flex flex-col items-end gap-0.5 self-end">
        {unlimited ? (
          <button
            onClick={() => setShowDetail(true)}
            className="flex items-center gap-1 active:opacity-70"
            aria-label="Heart unlimited (DOPA PASS)"
          >
            <HeartIcon filled size={20} />
            <span className="text-xs font-black text-amber-300">∞ HEART / DOPA PASS</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowDetail(true)}
              className="flex items-center gap-1 active:opacity-70"
              aria-label={`Heart ${count} / ${HEART_CAP}`}
            >
              <span className="flex items-center gap-0.5">
                {Array.from({ length: view.totalSlots }, (_, index) => (
                  <HeartIcon key={index} filled={isHeartSlotFilledAt(view, index)} size={20} />
                ))}
                {view.overflow > 0 && <span className="ml-0.5 text-sm font-black tabular-nums text-rose-300">+{view.overflow}</span>}
              </span>
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black leading-none text-white/60"
              >
                ＋
              </span>
            </button>
            {view.showRecoveryTimer && etaMs !== null && (
              <span className="text-[11px] font-bold tabular-nums text-white/40">
                次の回復まで {formatMmSs(etaMs)}
              </span>
            )}
          </>
        )}
      </div>
      {showDetail && <HeartDetailModal onClose={() => setShowDetail(false)} unlimited={unlimited} />}
    </>
  )
}
