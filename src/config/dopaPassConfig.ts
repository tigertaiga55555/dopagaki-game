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
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 51）: 正式リリース日時の
 * アンカー修正。
 *
 * 発見した既存の問題点: 以前の実装は`Date.now() - 3 * ONE_DAY_MS`——つまり
 * 「モジュールが読み込まれた瞬間（＝誰かがページを開いた瞬間）から3日前」を毎回
 * 再計算していた。これは一見「3日前にリリース済み」を表しているように見えるが、
 * 実際には基準点そのものが常にその場の現在時刻へ追従し続けるため、キャンペーンの
 * 残り日数が実際のカレンダー上の経過と一切対応しない（今日見ても1ヶ月後に見ても
 * 常に「残り27日」のまま固定されて見える、という静かな不整合——このラウンドの
 * coordinatorからの指摘どおり「開発中の今の時点を基準に計算される」結果、本当の
 * 発売日という実在の未来の1点に全く紐付いていなかった）。
 *
 * 修正: 正式リリース日時を、Date.now()から相対的に計算するのではなく、実在の未来の
 * 1点を指す固定タイムスタンプとして直接書く。ユーザーから共有された「Ver.6は
 * 2026年12月1日リリース予定」に合わせて設定した——発売日が確定・変更された場合は、
 * この1行（REAL_LAUNCH_RELEASE_AT_MS）だけを書き換えればよい（UI側には一切
 * ハードコードしない、という既存方針は変更していない）。これにより、実際の発売日前の
 * このPreview/開発期間中は、キャンペーンは（QA上書きをしない限り）常に「まだ開始前
 * （標準価格・キャンペーン非表示）」のまま正しく静止し、発売日を過ぎて初めて
 * 正しく30日間のカウントダウンが始まる。
 */
const REAL_LAUNCH_RELEASE_AT_MS = new Date('2026-12-01T00:00:00+09:00').getTime()

const RELEASE_OVERRIDE_KEY = 'dopagaki:qaPassReleaseAtOverrideV1'

/**
 * QA専用（Preview限定の確認を容易にするための薄いラッパー、dev/PassQaPanel.tsx参照）:
 * localStorageへ保存された上書き値があれば使う（例: 発売前のPreviewで「キャンペーン中」の
 * 見た目を今すぐ確認したいQA担当者が、ここだけ一時的に過去日へ上書きする）。保存値が
 * 無い・読み込み失敗時は、実在の正式リリース日時（REAL_LAUNCH_RELEASE_AT_MS）へ安全に
 * フォールバックする——本番UIが直接この関数を呼ぶのは問題ない（未設定時は実際の
 * 発売日のまま動くだけで、QA操作をしていない限り本番の挙動と完全に一致する）。
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
  return REAL_LAUNCH_RELEASE_AT_MS
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
