import type { Challenge500Tier } from './challenge500Config'

/**
 * Ver.6 Phase 3: 200〜500%「限界突破チャレンジ」の帯域ごとの視覚演出テーマ。
 *
 * ユーザー指示（実機QAフィードバック）: 200/300/400%台を「同じ演出部品の強弱」だけで
 * 作らず、それぞれ別の「人格」を持たせる——
 *   200台 = LIMIT BREAK（エネルギー解放、金色）
 *   300台 = OVERLOAD（暴走、電気的な水色）
 *   400台 = DANGER ZONE（危険、警告の赤）
 *   490%  = FINAL QUESTION（静寂、それまでの騒がしさを一度引かせる）
 * という4つの異なる視覚言語を切り替える。500%のconfetti/rainbow/golden burstは
 * ABSOLUTE CLEAR専用に予約し、途中の帯域では一切使わない（量の違いだけで強弱を
 * 作らないため）。
 *
 * このファイルは純粋な計算のみを行う（DOM・Reactに一切依存しない）。実際の描画は
 * components/Challenge500AmbientFX.tsxが、ここで計算したパラメータをCSS変数として
 * 要素に渡すだけの薄い層として担当する。
 *
 * 各帯域内でも「進むほど演出密度が上がる」ようにするため、tierProgress（0〜1、
 * 帯域内での現在位置）からparticleCount/pulseMs/glow強度を連続的に補間する
 * （10%刻みの個別コンポーネントを乱造しない、保守しやすい設計方針）。
 */

export type Challenge500ThemeId = 'limitBreak' | 'overload' | 'danger' | 'finalQuestion'

export interface Challenge500ThemeParams {
  id: Challenge500ThemeId
  /** 現在の帯域内での進行度（0〜1）。410%ならtier3で0.125、480%なら1。 */
  tierProgress: number
  /** 常駐パーティクルの個数（パフォーマンスのため全テーマで上限10に抑える）。 */
  particleCount: number
  /** 背景の呼吸的な明滅（pulse）の周期（ms）。小さいほど速い＝不安定に見える。 */
  pulseMs: number
  /** pulseの最小/最大不透明度。 */
  glowMin: number
  glowMax: number
  /** 演出に使うアクセントカラー（"R, G, B"形式。rgba()にそのまま埋め込んで使う）。 */
  colorRgb: string
}

const LIMIT_BREAK_COLOR_RGB = '250, 204, 21' // 金（既存のgolden系と同系統）
const OVERLOAD_COLOR_RGB = '56, 214, 255' // 電気的な水色
const DANGER_COLOR_RGB = '239, 68, 68' // 既存のULTIMATE QUESTION警告色と同じ赤

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * tier内での進行度（0〜1）。チェックポイント構造と対応させる：
 * tier1 = 200〜290%（次の300%チェックポイント手前まで）
 * tier2 = 300〜390%
 * tier3 = 400〜480%（490はFINAL QUESTIONという別テーマのため、tier3としては扱わない）
 */
export function getChallenge500TierProgress(tier: Challenge500Tier, percent: number): number {
  if (tier === 1) return clamp01((percent - 200) / 90)
  if (tier === 2) return clamp01((percent - 300) / 90)
  return clamp01((percent - 400) / 80)
}

/** progressの位置でfromとtoの間を線形補間する。 */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/**
 * 現在の状態から演出テーマパラメータを算出する。
 * isFinalQuestionPhase=true（percentが490、あと1問で500%の間ずっと）の場合は、
 * tierに関わらずFINAL QUESTIONテーマ（静寂）を返す——400%台の騒がしさを
 * 「足す」のではなく「引く」ことで最後の1問を際立たせる。
 */
export function getChallenge500Theme(tier: Challenge500Tier, percent: number, isFinalQuestionPhase: boolean): Challenge500ThemeParams {
  if (isFinalQuestionPhase) {
    return {
      id: 'finalQuestion',
      tierProgress: 1,
      particleCount: 0,
      pulseMs: 2800,
      glowMin: 0.06,
      glowMax: 0.14,
      colorRgb: DANGER_COLOR_RGB,
    }
  }

  const tierProgress = getChallenge500TierProgress(tier, percent)

  if (tier === 1) {
    return {
      id: 'limitBreak',
      tierProgress,
      particleCount: Math.round(lerp(3, 6, tierProgress)),
      pulseMs: Math.round(lerp(2600, 2000, tierProgress)),
      glowMin: lerp(0.22, 0.32, tierProgress),
      glowMax: lerp(0.4, 0.55, tierProgress),
      colorRgb: LIMIT_BREAK_COLOR_RGB,
    }
  }

  if (tier === 2) {
    return {
      id: 'overload',
      tierProgress,
      particleCount: Math.round(lerp(5, 9, tierProgress)),
      pulseMs: Math.round(lerp(1700, 1200, tierProgress)),
      glowMin: lerp(0.3, 0.42, tierProgress),
      glowMax: lerp(0.55, 0.7, tierProgress),
      colorRgb: OVERLOAD_COLOR_RGB,
    }
  }

  return {
    id: 'danger',
    tierProgress,
    particleCount: Math.round(lerp(6, 10, tierProgress)),
    pulseMs: Math.round(lerp(1100, 700, tierProgress)),
    glowMin: lerp(0.4, 0.5, tierProgress),
    glowMax: lerp(0.65, 0.85, tierProgress),
    colorRgb: DANGER_COLOR_RGB,
  }
}
