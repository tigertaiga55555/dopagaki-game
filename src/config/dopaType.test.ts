import { describe, expect, it } from 'vitest'
import { DOPA_TYPE_TIERS, getDopaType, getDopaTypeName } from './dopaType'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 104-105、115）: DOPA TYPE境界値テスト。
 * 結果画面／Xシェア本文／OGP画像／Achievement／Titleのすべてがこの1つの定義
 * （getDopaType/getDopaTypeName）だけを参照するため、境界値（各帯の下限・上限）を
 * 網羅的に検証する——境界値のズレは全ての参照箇所に同時に波及するため、ここで
 * 一度だけ厳密に確認すれば十分。
 */
describe('getDopaTypeName（item 104-105: DOPA TYPE単一定義の境界値）', () => {
  it.each([
    [0, '理性残存型ドパガキ'],
    [24, '理性残存型ドパガキ'],
    [25, '待てない型ドパガキ'],
    [49, '待てない型ドパガキ'],
    [50, '脳直タップ型ドパガキ'],
    [79, '脳直タップ型ドパガキ'],
    [80, '野生型ドパガキ'],
    [99, '野生型ドパガキ'],
    [100, '覚醒型ドパガキ'],
    [199, '覚醒型ドパガキ'],
    [200, 'ドパガキエース'],
    [299, 'ドパガキエース'],
    [300, '伝説のドパガキ'],
    [399, '伝説のドパガキ'],
    [400, 'ドパガキ王'],
    [499, 'ドパガキ王'],
    [500, 'ドパガキの神'],
  ])('percent=%i → %s', (percent, expected) => {
    expect(getDopaTypeName(percent)).toBe(expected)
  })

  it('500を超える値（万一の想定外入力）でも最上位のドパガキの神にフォールバックする', () => {
    expect(getDopaTypeName(999)).toBe('ドパガキの神')
  })

  it('以前案の「完全体型/刺激過剰摂取型/刺激処理型/限界突破型ドパガキ」は使用しない', () => {
    const names = DOPA_TYPE_TIERS.map((t) => t.name)
    expect(names).not.toContain('完全体型ドパガキ')
    expect(names).not.toContain('刺激過剰摂取型ドパガキ')
    expect(names).not.toContain('刺激処理型ドパガキ')
    expect(names).not.toContain('限界突破型ドパガキ')
  })

  it('9帯すべてが連続している（隙間・重複が無い）', () => {
    const sorted = [...DOPA_TYPE_TIERS].sort((a, b) => a.min - b.min)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].min).toBe(sorted[i - 1].max + 1)
    }
  })
})

describe('getDopaType（item 104-105）', () => {
  it('tier.idとnameを両方返す', () => {
    const tier = getDopaType(92)
    expect(tier.id).toBe('dopaTypeWild')
    expect(tier.name).toBe('野生型ドパガキ')
  })
})
