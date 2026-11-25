import { describe, expect, it } from 'vitest'
import {
  buildEndlessSharePayload,
  buildRushSharePayload,
  decodeResultSharePayload,
  encodeResultSharePayload,
} from './resultSharePayload'

describe('resultSharePayload（item 61-66: X結果シェアのURLペイロード生成）', () => {
  it('DOPA RUSH: percentを含めてエンコード→デコードで完全に復元できる', () => {
    const payload = buildRushSharePayload(428, 'nonce-1')
    const encoded = encodeResultSharePayload(payload)
    expect(decodeResultSharePayload(encoded)).toEqual(payload)
  })

  it.each(['beginner', 'intermediate', 'advanced'] as const)('ENDLESS %s: 難易度＋STREAKを含めてエンコード→デコードで完全に復元できる', (difficulty) => {
    const payload = buildEndlessSharePayload(difficulty, 23, 'nonce-2')
    const encoded = encodeResultSharePayload(payload)
    expect(decodeResultSharePayload(encoded)).toEqual(payload)
  })

  it('同じスコア・同じ難易度でもnonceが違えば別のIDになる（別プレイは別結果として扱う）', () => {
    const a = encodeResultSharePayload(buildRushSharePayload(100, 'nonce-a'))
    const b = encodeResultSharePayload(buildRushSharePayload(100, 'nonce-b'))
    expect(a).not.toBe(b)
  })

  it('同じpayload（同じnonce込み）を2回エンコードすると常に同じIDになる（再シェアの判定が安定する）', () => {
    const payload = buildEndlessSharePayload('advanced', 23, 'same-nonce')
    expect(encodeResultSharePayload(payload)).toBe(encodeResultSharePayload(payload))
  })

  it('壊れた/改ざんされたIDはnullを返す（架空の結果をでっち上げて表示しない）', () => {
    expect(decodeResultSharePayload('not-a-valid-payload-at-all')).toBeNull()
    expect(decodeResultSharePayload('')).toBeNull()
  })

  it('URLセーフな文字だけで構成される（+/=を含まない）', () => {
    const encoded = encodeResultSharePayload(buildRushSharePayload(999999, 'x'.repeat(40)))
    expect(encoded).not.toMatch(/[+/=]/)
  })
})
