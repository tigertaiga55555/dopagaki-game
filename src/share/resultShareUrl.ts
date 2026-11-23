/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: 結果シェアURLの形式を1箇所に
 * 集約する。challenge/url.ts・battle/privateRoomUrl.tsと完全に同じ方針
 * （常にwindow.location.originを使う——Preview環境でだけ正しく動くURLを共有する
 * 制約を自然に満たす）だが、パスは別（/s/:id）にする。
 *
 * ユーザー指示どおり、Challenge URL（「この記録を超えろ」という対戦の誘い）とは
 * 意味が異なる——結果シェアURLは「この結果を見て／ゲームを知って」という認知獲得用の
 * 別導線のため、/challenge/:idとは完全に別ルートにする。
 */
const RESULT_SHARE_PATH_PREFIX = '/s/'

export function buildResultShareUrl(resultId: string): string {
  return `${window.location.origin}${RESULT_SHARE_PATH_PREFIX}${resultId}`
}

/** 現在のURL（pathname）が結果シェアの着地ページなら、そのresultId（=payloadそのもの）を返す。 */
export function extractResultShareIdFromLocation(): string | null {
  const { pathname } = window.location
  if (!pathname.startsWith(RESULT_SHARE_PATH_PREFIX)) return null
  const id = pathname.slice(RESULT_SHARE_PATH_PREFIX.length).replace(/\/+$/, '')
  return id.length > 0 ? decodeURIComponent(id) : null
}
