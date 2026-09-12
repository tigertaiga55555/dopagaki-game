import type { RankDef } from '../types'

/**
 * ドパガキランク定義。
 * min/max/name はプレイテスト後に自由に調整してよい。
 * tier は結果コメント抽選（low/mid/high）に使う分類。
 */
export const RANKS: RankDef[] = [
  { id: 'super', min: 0, max: 499, name: '超ドパガキ', tier: 'low' },
  { id: 'kanari', min: 500, max: 999, name: 'かなりドパガキ', tier: 'low' },
  { id: 'normal', min: 1000, max: 1999, name: 'ドパガキ', tier: 'mid' },
  { id: 'choi', min: 2000, max: 2999, name: 'ちょいドパガキ', tier: 'mid' },
  { id: 'datsu', min: 3000, max: 3999, name: '脱ドパガキ', tier: 'high' },
  { id: 'master', min: 4000, max: Infinity, name: '我慢の達人', tier: 'high' },
]

export function getRank(point: number): RankDef {
  for (const rank of RANKS) {
    if (point >= rank.min && point <= rank.max) return rank
  }
  return RANKS[RANKS.length - 1]
}
