/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: フレンド対戦ルームのURL形式。
 * src/challenge/url.tsと同じ方針（常にwindow.location.originを使い、現在動作中の
 * Cloudflare Preview上でだけ正しく機能するURLにする）。
 */
const BATTLE_PATH_PREFIX = '/battle/'

export function buildBattleRoomUrl(roomCode: string): string {
  return `${window.location.origin}${BATTLE_PATH_PREFIX}${roomCode}`
}

/** 現在のURL（pathname）がフレンド対戦の合流ページなら、そのroomCodeを返す。それ以外はnull。 */
export function extractRoomCodeFromLocation(): string | null {
  const { pathname } = window.location
  if (!pathname.startsWith(BATTLE_PATH_PREFIX)) return null
  const code = pathname.slice(BATTLE_PATH_PREFIX.length).replace(/\/+$/, '')
  return code.length > 0 ? decodeURIComponent(code) : null
}
