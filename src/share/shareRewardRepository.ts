import { SHARE_REWARD_DAILY_CAP, SHARE_REWARD_HEART_GRANT } from '../config/shareRewardConfig'
import { grantRewardedHeart, localHeartRepository } from '../utils/heartRepository'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: X結果シェアのHeart報酬を管理する。
 * utils/heartRepository.ts・utils/rewardedAdStorage.ts・payment/entitlementRepository.ts
 * と同じ方針（Repositoryインターフェース＋ローカル実装、呼び出し元はこの型だけに依存）。
 * 今回はアカウント・サーバーがまだ無いためlocalStorageへ保存するだけだが、将来サーバー
 * 権威の実装（Worker API経由）へ丸ごと差し替える際も、呼び出し元（結果画面）のコードは
 * 一切変更不要にするための境界。
 *
 * 日付境界は既存のutils/rewardedAdStorage.tsとまったく同じ簡易実装（UTC日付文字列の
 * 比較）を踏襲する——「JST境界」という字面の指示より、既存コードが実際に何をしている
 * かを優先して合わせる、というユーザー指示（「rewardedAdStorage.tsが既に使っている
 * 境界規則に合わせる」）に従った。2つの日次カウンター（広告3回／シェア2回）は、
 * それぞれ別のlocalStorageキー・別の状態オブジェクトで管理するため完全に独立している。
 *
 * 「1結果につき1回まで」は日次カウンターとは別の軸のガード——resultSharePayload.tsで
 * 生成されるresultId（nonce込みのエンコード文字列、同じプレイを再シェアしても同じ値に
 * なる）ごとに、既に報酬済みかどうかを別リストで管理する。このリストは日をまたいでも
 * リセットしない（同じ結果を後日再シェアしても二重には付与しない）。無制限に増え続け
 * ないよう、直近N件だけを保持する（それより古い結果IDは、現実的にはもう誰も再シェア
 * しない前提の安全な簡略化——最終報告書に明記する）。
 */
const SHARE_REWARD_STATE_KEY = 'dopagaki:shareRewardStateV1'
const REWARDED_RESULT_ID_HISTORY_CAP = 200

interface ShareRewardState {
  dateKey: string
  countToday: number
  /** 新しいものが配列の末尾。cap超過分は先頭（古いもの）から捨てる。 */
  rewardedResultIds: string[]
}

function dateKeyFor(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function readState(now: number): ShareRewardState {
  const todayKey = dateKeyFor(now)
  try {
    const raw = localStorage.getItem(SHARE_REWARD_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ShareRewardState>
      const rewardedResultIds = Array.isArray(parsed.rewardedResultIds) ? parsed.rewardedResultIds.filter((id) => typeof id === 'string') : []
      if (parsed.dateKey === todayKey && typeof parsed.countToday === 'number') {
        return { dateKey: todayKey, countToday: parsed.countToday, rewardedResultIds }
      }
      // 日付が変わっていても、resultIdの履歴（「1結果につき1回まで」）だけは引き継ぐ。
      // 日次カウンターだけを0へリセットする。
      return { dateKey: todayKey, countToday: 0, rewardedResultIds }
    }
  } catch {
    // フォールスルーして初期値を返す。
  }
  return { dateKey: todayKey, countToday: 0, rewardedResultIds: [] }
}

function writeState(state: ShareRewardState): void {
  try {
    localStorage.setItem(SHARE_REWARD_STATE_KEY, JSON.stringify(state))
  } catch {
    // 致命的ではない。
  }
}

export interface ShareRewardRepository {
  /** 本日すでに付与した回数（0〜SHARE_REWARD_DAILY_CAP）。 */
  getDailyShareRewardCount(now?: number): number
  /** このresultIdへ今から付与してよいか（未報酬かつ本日上限未満）を、何も変更せずに判定する。 */
  canRewardResult(resultId: string, now?: number): boolean
  /**
   * 実際に付与する。内部でcanRewardResultと同じ判定を行い、満たす場合だけ
   * +1 Heart（utils/heartRepository.grantRewardedHeart、リワード広告と同じ仕組みを再利用
   * ——5個の自然回復上限を超えて持てる、という既存の前例をそのまま踏襲する）を与えて
   * markResultRewardedも行う。二重クリック・リロード後の再シェアいずれでも、満たさない
   * 場合はgranted:falseを返すだけで、Heartも日次カウンターも一切変化させない。
   */
  grantShareReward(resultId: string, now?: number): { granted: boolean; heartCount: number; remainingToday: number }
  /** resultIdを「報酬済み」として記録し、日次カウンターを1進める（grantShareReward内部からも呼ぶ）。 */
  markResultRewarded(resultId: string, now?: number): void
}

export const localShareRewardRepository: ShareRewardRepository = {
  getDailyShareRewardCount(now = Date.now()): number {
    return readState(now).countToday
  },

  canRewardResult(resultId: string, now = Date.now()): boolean {
    const state = readState(now)
    if (state.countToday >= SHARE_REWARD_DAILY_CAP) return false
    return !state.rewardedResultIds.includes(resultId)
  },

  markResultRewarded(resultId: string, now = Date.now()): void {
    const state = readState(now)
    if (state.rewardedResultIds.includes(resultId)) {
      writeState(state)
      return
    }
    const nextIds = [...state.rewardedResultIds, resultId].slice(-REWARDED_RESULT_ID_HISTORY_CAP)
    writeState({ dateKey: state.dateKey, countToday: state.countToday + 1, rewardedResultIds: nextIds })
  },

  grantShareReward(resultId, now = Date.now()) {
    if (!localShareRewardRepository.canRewardResult(resultId, now)) {
      const state = readState(now)
      return {
        granted: false,
        heartCount: localHeartRepository.getHeartCount(now),
        remainingToday: Math.max(0, SHARE_REWARD_DAILY_CAP - state.countToday),
      }
    }
    const heartCount = grantRewardedHeart(now)
    localShareRewardRepository.markResultRewarded(resultId, now)
    const remainingToday = Math.max(0, SHARE_REWARD_DAILY_CAP - localShareRewardRepository.getDailyShareRewardCount(now))
    return { granted: true, heartCount, remainingToday }
  },
}

/**
 * 次フェーズ（item 61-66）: 「PASS所有者はこの日次カウンターを一切消費しない」の判定を、
 * 結果画面（ResultScreen.tsx/EndlessResultScreen.tsx）側に素のif文として重複させず、
 * この1箇所へ集約する——ユニットテストでも「hasPass=trueの間は、何回呼んでも
 * カウンター・報酬済みリストのどちらも一切変化しない」ことをReactを経由せず直接検証できる。
 */
export function grantShareRewardIfEligible(hasPass: boolean, resultId: string, now = Date.now()): { granted: boolean; heartCount: number } {
  if (hasPass) return { granted: false, heartCount: localHeartRepository.getHeartCount(now) }
  const outcome = localShareRewardRepository.grantShareReward(resultId, now)
  return { granted: outcome.granted, heartCount: outcome.heartCount }
}

export { SHARE_REWARD_DAILY_CAP, SHARE_REWARD_HEART_GRANT }
