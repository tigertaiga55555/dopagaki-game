/**
 * 演出レベル（0〜6）の見た目定義。
 * レベル自体は各フェーズの進行＋高COMBO/高ドパガキ度のボーナスで決まる（useRushGame）。
 * お題の視認性を最優先し、レベルが上がるほど背景・発光・パーティクルを足していく。
 */
export interface VisualLevelDef {
  level: number
  label: string
  glow: boolean
  neon: boolean
  particles: boolean
  gold: boolean
  intense: boolean
}

export const VISUAL_LEVELS: VisualLevelDef[] = [
  { level: 0, label: 'シンプル', glow: false, neon: false, particles: false, gold: false, intense: false },
  { level: 1, label: '発光', glow: true, neon: false, particles: false, gold: false, intense: false },
  { level: 2, label: 'ネオン', glow: true, neon: true, particles: false, gold: false, intense: false },
  { level: 3, label: 'パーティクル', glow: true, neon: true, particles: true, gold: false, intense: false },
  { level: 4, label: 'ゴールド', glow: true, neon: true, particles: true, gold: true, intense: false },
  { level: 5, label: 'ギラギラ', glow: true, neon: true, particles: true, gold: true, intense: true },
]

export function getVisualLevelDef(level: number): VisualLevelDef {
  const clamped = Math.max(0, Math.min(VISUAL_LEVELS.length - 1, Math.round(level)))
  return VISUAL_LEVELS[clamped]
}
