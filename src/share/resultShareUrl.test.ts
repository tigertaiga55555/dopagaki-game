import { afterEach, describe, expect, it } from 'vitest'
import { buildResultShareUrl, extractResultShareIdFromLocation } from './resultShareUrl'

/** challenge/url.test.tsと同じ方針（node環境・DOM無し、window.locationだけ最小限用意する）。 */
function setLocation(pathname: string, origin = 'https://ver6-dopagaki-game.tiger-taiga-55555.workers.dev') {
  ;(globalThis as unknown as { window: { location: { origin: string; pathname: string } } }).window = {
    location: { origin, pathname },
  }
}

describe('resultShareUrl（item 61-66: X結果シェアURL /s/:id）', () => {
  afterEach(() => {
    setLocation('/')
  })

  it('buildResultShareUrl: 現在のorigin + /s/{id} を組み立てる', () => {
    setLocation('/')
    expect(buildResultShareUrl('abc-123')).toBe('https://ver6-dopagaki-game.tiger-taiga-55555.workers.dev/s/abc-123')
  })

  it('/challenge/:idや/room/:codeとは別のパスである', () => {
    setLocation('/')
    expect(buildResultShareUrl('abc-123')).not.toContain('/challenge/')
    expect(buildResultShareUrl('abc-123')).not.toContain('/room/')
  })

  it('extractResultShareIdFromLocation: /s/{id} パスからidを取り出す', () => {
    setLocation('/s/abc-123')
    expect(extractResultShareIdFromLocation()).toBe('abc-123')
  })

  it('末尾スラッシュがあっても取り出せる', () => {
    setLocation('/s/abc-123/')
    expect(extractResultShareIdFromLocation()).toBe('abc-123')
  })

  it('/s/で始まらないパスはnull', () => {
    setLocation('/challenge/abc-123')
    expect(extractResultShareIdFromLocation()).toBeNull()
    setLocation('/')
    expect(extractResultShareIdFromLocation()).toBeNull()
  })
})
