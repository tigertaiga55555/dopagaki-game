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

function previewParam(): string | null {
  if (typeof window === 'undefined') return null
  if (!__DOPAGAKI_PREVIEW_ENABLED__) return null
  return new URLSearchParams(window.location.search).get('preview')
}

/**
 * Ver.5.0(51.): ?preview=finaltrial — 120%到達→FINAL DOPA TRIAL突入演出→実際のFINAL HUD→
 * Q1から本当にプレイできる確認モード。旧?preview=clear120はここに整理された
 * （120%はもはやCLEARではなくFINAL DOPA TRIALの入口になったため、「clear120」という
 * 名前自体が意味を失った）。
 */
export function isFinalTrialPreviewRequested(): boolean {
  return previewParam() === 'finaltrial'
}

/**
 * Ver.5.0(51.): ?preview=finalquestion — 195%から開始し、FINAL QUESTION（箱シャッフル）を
 * 実際に回答可能な状態で確認できるモード。
 */
export function isFinalQuestionPreviewRequested(): boolean {
  return previewParam() === 'finalquestion'
}

/**
 * Ver.5.0(51.): ?preview=clear200 — FINAL QUESTION正解直後の200%真のPERFECT CLEAR演出
 * （ゲーム最大の演出）と、専用の200%結果画面を確認できるモード。
 */
export function isClear200PreviewRequested(): boolean {
  return previewParam() === 'clear200'
}
