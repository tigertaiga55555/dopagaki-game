/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: DOPA PASSの価格・発売キャンペーン判定ロジック。
 * battle/battleRoomEngine.tsと同じ「pure engine + 薄いラッパー」方針——isLaunchCampaignActive
 * /getCurrentPassPrice/daysRemainingInLaunchCampaignはDOM/localStorageに一切依存しない
 * 純粋関数（releaseAtMsを明示的な引数で受け取る）。価格・キャンペーン判定ロジックを
 * UI側へ一切ハードコードしない（必ずこのファイルの関数経由で取得する）、というユーザー指示。
 *
 * キャンペーン残り日数は「秒単位のカウントダウン」ではなく「残り日数」表示にする
 * （ユーザー指示）。クライアントの時計は最終的な購入価格の権威にはしない——将来の実決済
 * プロバイダ統合後は、実際に課金される価格はプロバイダ側（Apple IAP等）が確定するため、
 * ここでの計算はあくまで「購入前にUIへ表示するための目安」であり、QA専用の
 * payment/qaPaymentAdapter.tsもこの関数の戻り値をそのまま使うだけで、別の価格計算を
 * 独自に持たない。
 */
export const DOPA_PASS_STANDARD_PRICE_YEN = 1980
export const DOPA_PASS_LAUNCH_CAMPAIGN_PRICE_YEN = 1500
const ONE_DAY_MS = 24 * 60 * 60 * 1000
export const LAUNCH_CAMPAIGN_DURATION_MS = 30 * ONE_DAY_MS

export function isLaunchCampaignActive(nowMs: number, releaseAtMs: number): boolean {
  return nowMs >= releaseAtMs && nowMs < releaseAtMs + LAUNCH_CAMPAIGN_DURATION_MS
}

export function getCurrentPassPrice(nowMs: number, releaseAtMs: number): number {
  return isLaunchCampaignActive(nowMs, releaseAtMs) ? DOPA_PASS_LAUNCH_CAMPAIGN_PRICE_YEN : DOPA_PASS_STANDARD_PRICE_YEN
}

/** キャンペーン中でなければ0。「残り日数」表示用（秒単位カウントダウンにしない、というユーザー指示）。 */
export function daysRemainingInLaunchCampaign(nowMs: number, releaseAtMs: number): number {
  if (!isLaunchCampaignActive(nowMs, releaseAtMs)) return 0
  const remainingMs = releaseAtMs + LAUNCH_CAMPAIGN_DURATION_MS - nowMs
  return Math.max(1, Math.ceil(remainingMs / ONE_DAY_MS))
}

/**
 * 正式リリース日時。確定前のため、この1箇所の定数だけを書き換えれば全体へ反映される
 * （UI側には一切ハードコードしない）。Preview QA検証のため、デフォルト値は「数日前に
 * リリース済み」扱いにしてキャンペーン中の表示を即確認できるようにしてある
 * （本番確定後はここを実際の日時へ置き換えるだけでよい）。
 */
const DEFAULT_RELEASE_AT_MS = Date.now() - 3 * ONE_DAY_MS

const RELEASE_OVERRIDE_KEY = 'dopagaki:qaPassReleaseAtOverrideV1'

/**
 * QA専用（Preview限定の確認を容易にするための薄いラッパー）: localStorageへ保存された
 * 上書き値があれば使う。保存値が無い・読み込み失敗時はDEFAULT_RELEASE_AT_MSへ安全に
 * フォールバックする。本番UIが直接この関数を呼ぶのは問題ない
 * （未設定時は上のデフォルトのまま動くだけで、QA操作をしていない限り本番挙動と同じ）。
 */
export function getEffectiveReleaseAtMs(): number {
  try {
    const raw = localStorage.getItem(RELEASE_OVERRIDE_KEY)
    if (raw) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) return parsed
    }
  } catch {
    // localStorageアクセス不可時はデフォルトへフォールバック。
  }
  return DEFAULT_RELEASE_AT_MS
}

/** Preview/QA専用: リリース日時を直接差し替える（PassQaPanel参照）。nullで既定値へ戻す。 */
export function qaSetReleaseAtOverrideMs(ms: number | null): void {
  try {
    if (ms === null) localStorage.removeItem(RELEASE_OVERRIDE_KEY)
    else localStorage.setItem(RELEASE_OVERRIDE_KEY, String(ms))
  } catch {
    // 致命的ではない。
  }
}
