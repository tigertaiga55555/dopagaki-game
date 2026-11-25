import { REWARDED_AD_DAILY_CAP } from '../config/adPolicyConfig'
import { grantRewardedHeart } from './heartRepository'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: リワード広告（無料ユーザーのみ、1日3回まで）の
 * 視聴回数管理。日付（ローカル日付、UTC日単位の簡易実装）が変わると自動的に0へ戻る。
 */
interface RewardedAdState {
  dateKey: string
  count: number
}

const REWARDED_AD_STATE_KEY = 'dopagaki:rewardedAdStateV1'

function dateKeyFor(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function readState(now: number): RewardedAdState {
  const todayKey = dateKeyFor(now)
  try {
    const raw = localStorage.getItem(REWARDED_AD_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RewardedAdState>
      if (parsed.dateKey === todayKey && typeof parsed.count === 'number') {
        return { dateKey: todayKey, count: parsed.count }
      }
    }
  } catch {
    // フォールスルーして初期値を返す。
  }
  return { dateKey: todayKey, count: 0 }
}

function writeState(state: RewardedAdState): void {
  try {
    localStorage.setItem(REWARDED_AD_STATE_KEY, JSON.stringify(state))
  } catch {
    // 致命的ではない。
  }
}

export function getRewardedAdViewsRemainingToday(now = Date.now()): number {
  return Math.max(0, REWARDED_AD_DAILY_CAP - readState(now).count)
}

export function canWatchRewardedAd(now = Date.now()): boolean {
  return getRewardedAdViewsRemainingToday(now) > 0
}

/** 視聴完了時に呼ぶ。即+1 Heart（heartRepository.grantRewardedHeart）＋本日の視聴回数を1進める。 */
export function recordRewardedAdViewed(now = Date.now()): number {
  const state = readState(now)
  writeState({ dateKey: state.dateKey, count: state.count + 1 })
  return grantRewardedHeart(now)
}
