/**
 * Ver.5.0追加: Google Analytics 4（測定ID G-1BRJXLJ9P7、index.htmlのgtag snippet参照）への
 * カスタムイベント送信をこの1箇所に集約する。
 *
 * gtag関数はindex.htmlの同期スクリプトでwindow上に必ず定義される（GA4本体スクリプトの
 * 読み込み自体は非同期だが、gtag()はdataLayer.pushの薄いラッパーとして即座に使える）ため、
 * 通常はここでwindow.gtagが存在しないことはない。ただし広告ブロッカー等でGA4スクリプトの
 * 読み込み自体がブロックされるとdataLayer.pushが実質的な何もしない操作になるだけで、
 * ゲーム側の処理には一切影響しない（trackEvent自体もtypeof window.gtagのチェックで
 * 存在しない場合は静かに何もしない安全な実装にしている）。
 *
 * 送信するのは標準の自動収集パラメータとイベント名・final_percentのみで、
 * 個人を特定できる情報は一切含めない。
 */

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: GtagFn
    dataLayer?: unknown[]
  }
}

function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

/** ゲーム開始（タイトルからのSTART・結果画面からのリトライの両方で発火）。 */
export function trackGameStart(): void {
  trackEvent('game_start')
}

/** 100％到達・DOPA OVERDRIVE突入。 */
export function trackOverdriveReached(): void {
  trackEvent('overdrive_reached')
}

/** 120％到達・FINAL DOPA TRIAL突入。 */
export function trackFinalReached(): void {
  trackEvent('final_reached')
}

/** ULTIMATE QUESTION（FINAL DOPA TRIAL Q16）到達。 */
export function trackUltimateReached(): void {
  trackEvent('ultimate_reached')
}

/** 200％ PERFECT CLEAR。 */
export function trackPerfectClear(): void {
  trackEvent('perfect_clear')
}

/** 結果画面表示。最終ドパガキ度をfinal_percentとして送信する。 */
export function trackResultView(finalPercent: number): void {
  trackEvent('result_view', { final_percent: finalPercent })
}

/** 結果シェアボタン（「画像付きでシェア」）押下。 */
export function trackShareClick(): void {
  trackEvent('share_click')
}

/** 結果画面からの再プレイ。 */
export function trackReplayStart(): void {
  trackEvent('replay_start')
}
