import { useEffect, useState } from 'react'
import { formatMmSs } from '../utils/formatTime'
import { localHeartRepository } from '../utils/heartRepository'
import { canWatchRewardedAd, getRewardedAdViewsRemainingToday, recordRewardedAdViewed } from '../utils/rewardedAdStorage'
import { MockRewardedAd } from './MockRewardedAd'
import { sfx } from '../utils/sound'

interface Props {
  /** 次の1回復までの残りミリ秒（既に0以上へ回復していた場合に備え、呼び出し元が開く直前の最新値を渡す）。 */
  initialEtaMs: number
  onClose: () => void
  /** 次フェーズ（DOPA PASS基盤ラウンド）: Heartを消費した本人が無料ユーザーかどうか（PASS所有者はこのモーダル自体に到達しないため、呼び出し元が判定した結果だけを受け取る）。 */
  canUseRewardedAd?: boolean
}

/**
 * 次フェーズ（DOPA HEART本実装、item 12）: Heart 0でDOPA RUSH/ENDLESSを開始しようとした
 * 際に表示するモーダル。「ハートがありません」「次の回復まで XX:XX」の最小表示に加え、
 * 次フェーズ（DOPA PASS基盤ラウンド）で、無料ユーザー向けに「動画を見て+1」ボタン
 * （1日3回まで、utils/rewardedAdStorage.ts）を追加した。
 */
export function HeartEmptyModal({ initialEtaMs, onClose, canUseRewardedAd = true }: Props) {
  const [etaMs, setEtaMs] = useState(initialEtaMs)
  const [watchingAd, setWatchingAd] = useState(false)
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setEtaMs((prev) => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const canWatch = canUseRewardedAd && canWatchRewardedAd() && !granted

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
        {granted ? (
          <p className="mb-3 text-sm font-black text-emerald-300">+1 Heart 獲得しました</p>
        ) : canWatch ? (
          <button
            onClick={() => {
              sfx.uiTap()
              setWatchingAd(true)
            }}
            className="mb-3 w-full rounded-2xl bg-amber-500/90 py-3 text-sm font-black text-black active:scale-95"
          >
            動画を見て +1 Heart（本日あと{getRewardedAdViewsRemainingToday()}回）
          </button>
        ) : null}
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
            setEtaMs(localHeartRepository.getNextRecoveryEtaMs() ?? 0)
          }}
        />
      )}
    </div>
  )
}
