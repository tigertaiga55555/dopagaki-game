import { useEffect, useState } from 'react'
import { HEART_CAP, HEART_REGEN_MS, localHeartRepository } from '../utils/heartRepository'
import { formatMmSs } from '../utils/formatTime'
import { canWatchRewardedAd, getRewardedAdViewsRemainingToday, recordRewardedAdViewed } from '../utils/rewardedAdStorage'
import { HeartIcon } from './HeartIcon'
import { MockRewardedAd } from './MockRewardedAd'
import { sfx } from '../utils/sound'

interface Props {
  onClose: () => void
  /** 次フェーズ（DOPA PASS基盤ラウンド）: PASS所有者は無制限のため、所持数表示・リワード広告ボタンの両方を隠す。 */
  unlimited?: boolean
}

const REGEN_MINUTES = HEART_REGEN_MS / (60 * 1000)

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 5）: Heart表示をタップした際に開く
 * 詳細モーダル。所持数・自然回復上限・回復レート・次回回復までの残り時間を表示する。
 * 次フェーズ（DOPA PASS基盤ラウンド）で、無料ユーザー向けのリワード広告ボタンと、
 * PASS所有者向けの「無制限」表示を追加した。
 */
export function HeartDetailModal({ onClose, unlimited = false }: Props) {
  const [count, setCount] = useState(() => localHeartRepository.getHeartCount())
  const [etaMs, setEtaMs] = useState(() => localHeartRepository.getNextRecoveryEtaMs())
  const [watchingAd, setWatchingAd] = useState(false)
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(localHeartRepository.getHeartCount())
      setEtaMs(localHeartRepository.getNextRecoveryEtaMs())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const canWatch = !unlimited && canWatchRewardedAd() && !granted

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-rose-400/30 bg-[#1a0e2e] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-center gap-1">
          <HeartIcon filled size={28} />
          {unlimited ? (
            <span className="text-2xl font-black text-amber-300">∞ HEART / DOPA PASS</span>
          ) : (
            <span className="text-2xl font-black tabular-nums text-white">
              {count} <span className="text-sm font-bold text-white/40">/ {HEART_CAP}</span>
            </span>
          )}
        </div>

        {!unlimited && (
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
        )}

        {granted && <p className="mb-3 text-sm font-black text-emerald-300">+1 Heart 獲得しました</p>}
        {canWatch && (
          <button
            onClick={() => {
              sfx.uiTap()
              setWatchingAd(true)
            }}
            className="mb-3 w-full rounded-2xl bg-amber-500/90 py-3 text-sm font-black text-black active:scale-95"
          >
            動画を見て +1 Heart（本日あと{getRewardedAdViewsRemainingToday()}回）
          </button>
        )}

        <button
          onClick={() => {
            sfx.uiTap()
            onClose()
          }}
          className="w-full rounded-2xl bg-white/10 py-3 text-sm font-black text-white active:scale-95"
        >
          閉じる
        </button>
      </div>
      {watchingAd && (
        <MockRewardedAd
          onCancel={() => setWatchingAd(false)}
          onComplete={() => {
            recordRewardedAdViewed()
            setWatchingAd(false)
            setGranted(true)
            setCount(localHeartRepository.getHeartCount())
            setEtaMs(localHeartRepository.getNextRecoveryEtaMs())
          }}
        />
      )}
    </div>
  )
}
