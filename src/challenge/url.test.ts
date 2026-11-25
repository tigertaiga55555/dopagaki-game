import { afterEach, describe, expect, it } from 'vitest'
import { buildChallengeUrl, extractChallengeIdFromLocation } from './url'

/**
 * このプロジェクトのvitestはデフォルト（node環境、DOM無し）で動くため、windowは
 * 元々存在しない。url.tsが参照するwindow.locationだけを最小限のオブジェクトとして
 * グローバルに用意する（jsdom等は導入しない、既存方針どおり）。
 */
function setLocation(pathname: string, origin = 'https://ver6-dopagaki-game.tiger-taiga-55555.workers.dev') {
  ;(globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
    location: { origin, pathname },
  }
}

describe('Challenge URL (Ver.6 Phase 5.2: Challenge share URL生成)', () => {
  afterEach(() => {
    setLocation('/')
  })

  it('buildChallengeUrl: 現在のorigin + /challenge/{id} を組み立てる', () => {
    setLocation('/')
    const url = buildChallengeUrl('abc-123')
    expect(url).toBe('https://ver6-dopagaki-game.tiger-taiga-55555.workers.dev/challenge/abc-123')
  })

  it('extractChallengeIdFromLocation: /challenge/{id} パスからidを取り出す', () => {
    setLocation('/challenge/abc-123')
    expect(extractChallengeIdFromLocation()).toBe('abc-123')
  })

  it('extractChallengeIdFromLocation: 末尾スラッシュがあっても正しく取り出す', () => {
    setLocation('/challenge/abc-123/')
    expect(extractChallengeIdFromLocation()).toBe('abc-123')
  })

  it('extractChallengeIdFromLocation: Challenge URLでなければnullを返す', () => {
    setLocation('/')
    expect(extractChallengeIdFromLocation()).toBeNull()
    setLocation('/profile')
    expect(extractChallengeIdFromLocation()).toBeNull()
  })

  it('extractChallengeIdFromLocation: URLエンコードされたidもデコードして返す', () => {
    setLocation('/challenge/' + encodeURIComponent('id with space'))
    expect(extractChallengeIdFromLocation()).toBe('id with space')
  })
})
