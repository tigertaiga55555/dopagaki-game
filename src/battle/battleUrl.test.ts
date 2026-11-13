import { afterEach, describe, expect, it } from 'vitest'
import { buildBattleRoomUrl, extractRoomCodeFromLocation } from './battleUrl'

/**
 * src/challenge/url.test.tsと同じ方針（jsdom無し・node環境のまま、window.locationだけを
 * 最小限のグローバルとして用意する）。
 */
function setLocation(pathname: string, origin = 'https://ver6-dopagaki-game.tiger-taiga-55555.workers.dev') {
  ;(globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
    location: { origin, pathname },
  }
}

describe('Battle room URL (Ver.6 Phase 6: フレンド対戦ルーム共有URL生成)', () => {
  afterEach(() => {
    setLocation('/')
  })

  it('buildBattleRoomUrl: 現在のorigin + /battle/{roomCode} を組み立てる', () => {
    setLocation('/')
    const url = buildBattleRoomUrl('ABC234')
    expect(url).toBe('https://ver6-dopagaki-game.tiger-taiga-55555.workers.dev/battle/ABC234')
  })

  it('extractRoomCodeFromLocation: /battle/{roomCode} パスからroomCodeを取り出す', () => {
    setLocation('/battle/ABC234')
    expect(extractRoomCodeFromLocation()).toBe('ABC234')
  })

  it('extractRoomCodeFromLocation: 末尾スラッシュがあっても正しく取り出す', () => {
    setLocation('/battle/ABC234/')
    expect(extractRoomCodeFromLocation()).toBe('ABC234')
  })

  it('extractRoomCodeFromLocation: Battle URLでなければnullを返す', () => {
    setLocation('/')
    expect(extractRoomCodeFromLocation()).toBeNull()
    setLocation('/challenge/abc-123')
    expect(extractRoomCodeFromLocation()).toBeNull()
  })

  it('extractRoomCodeFromLocation: URLエンコードされたroomCodeもデコードして返す', () => {
    setLocation('/battle/' + encodeURIComponent('code with space'))
    expect(extractRoomCodeFromLocation()).toBe('code with space')
  })
})
