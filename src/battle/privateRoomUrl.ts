/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOMの合流URL形式。
 * battle/battleUrl.tsと完全に同じ方針（常にwindow.location.originを使う）、パスだけ別
 * （/room/:roomCode——フレンド対戦の/battle/:roomCodeとは別の入口にする）。
 */
const PRIVATE_ROOM_PATH_PREFIX = '/room/'

export function buildPrivateRoomUrl(roomCode: string): string {
  return `${window.location.origin}${PRIVATE_ROOM_PATH_PREFIX}${roomCode}`
}

/** 現在のURL（pathname）がPRIVATE ROOMの合流ページなら、そのroomCodeを返す。それ以外はnull。 */
export function extractPrivateRoomCodeFromLocation(): string | null {
  const { pathname } = window.location
  if (!pathname.startsWith(PRIVATE_ROOM_PATH_PREFIX)) return null
  const code = pathname.slice(PRIVATE_ROOM_PATH_PREFIX.length).replace(/\/+$/, '')
  return code.length > 0 ? decodeURIComponent(code) : null
}
