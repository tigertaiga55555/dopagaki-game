/**
 * Vercel Previewでのみ使える、DOPA OVERDRIVE演出の一時確認モードの入り口判定。
 * 本番の隠し条件・スコア計算・通常プレイのロジックには一切触れない。
 * URLに ?preview=overdrive が付いており、かつ__DOPAGAKI_PREVIEW_ENABLED__
 * （Productionビルドでは常にfalse）がtrueの場合のみ有効。
 */
export function isOverdrivePreviewRequested(): boolean {
  if (typeof window === 'undefined') return false
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return false
  const params = new URLSearchParams(window.location.search)
  return params.get('preview') === 'overdrive'
}
