import type { EndlessDifficulty } from '../types'

/**
 * Ver.6 Phase 4.1（難易度再設計）: Endless 初級/中級/上級の視覚テーマ。
 *
 * ユーザー指示: 「難易度を選んだ瞬間に、初級っぽい／中級っぽい／上級っぽいが視覚的に分かること」。
 * challenge500Theme.tsと同じ方針で、このファイルは純粋なデータ定義のみを行う（DOM・Reactに
 * 一切依存しない）。実際の適用は各画面（EndlessSelectScreen/EndlessPlayScreen/
 * EndlessResultScreen）がclassNameへそのまま埋め込むだけ。Tailwind CSS v4はプロジェクト内の
 * 全ソースファイル（.tsも含む）を自動スキャンするため、ここに書いた完全なクラス名文字列も
 * 問題なく生成対象になる（動的な文字列結合は一切していない）。
 *
 * 配色方針（ユーザー指示どおり）:
 *   初級 = 緑〜ミント系（入りやすい・爽やか・安定 = FLOW）
 *   中級 = 青〜シアン系（集中・クール・テクニカル = FOCUS）
 *   上級 = 赤〜オレンジ系（危険・緊張・高難易度 = DANGER）
 */
export interface EndlessThemeParams {
  id: EndlessDifficulty
  /** 選択画面・プレイ画面に小さく添える雰囲気ラベル。 */
  mood: string
  /** rgba()へ直接埋め込むための「R, G, B」文字列（インラインstyle用）。 */
  colorRgb: string
  /** STREAK数値・見出しなどのアクセント文字色。 */
  textClass: string
  /** 難易度選択カードの背景・縁取り。 */
  cardClass: string
  /** プレイ画面のタイマーバー色。 */
  timerBarClass: string
  /** 結果画面「もう一度」ボタン等のグラデーション背景。 */
  buttonGradientClass: string
  /** 上記ボタンの押し込み影（通常時/active時）。 */
  buttonShadowClass: string
  /** STREAK数値・節目バナーのglow（drop-shadow）。 */
  glowClass: string
}

export const ENDLESS_THEME: Record<EndlessDifficulty, EndlessThemeParams> = {
  beginner: {
    id: 'beginner',
    mood: 'FLOW',
    colorRgb: '52, 211, 153',
    textClass: 'text-emerald-300',
    cardClass: 'border border-emerald-400/25 bg-emerald-500/10',
    timerBarClass: 'bg-emerald-400/80',
    buttonGradientClass: 'bg-gradient-to-b from-emerald-400 to-teal-500',
    buttonShadowClass: 'shadow-[0_6px_0_0_rgba(13,148,136,0.8)] active:shadow-[0_2px_0_0_rgba(13,148,136,0.8)]',
    glowClass: 'drop-shadow-[0_0_16px_rgba(52,211,153,0.75)]',
  },
  intermediate: {
    id: 'intermediate',
    mood: 'FOCUS',
    colorRgb: '34, 211, 238',
    textClass: 'text-cyan-300',
    cardClass: 'border border-cyan-400/25 bg-cyan-500/10',
    timerBarClass: 'bg-cyan-400/80',
    buttonGradientClass: 'bg-gradient-to-b from-cyan-400 to-blue-500',
    buttonShadowClass: 'shadow-[0_6px_0_0_rgba(29,78,216,0.8)] active:shadow-[0_2px_0_0_rgba(29,78,216,0.8)]',
    glowClass: 'drop-shadow-[0_0_16px_rgba(34,211,238,0.75)]',
  },
  advanced: {
    id: 'advanced',
    mood: 'DANGER',
    colorRgb: '248, 113, 113',
    textClass: 'text-orange-300',
    cardClass: 'border border-red-400/25 bg-red-500/10',
    timerBarClass: 'bg-red-400/80',
    buttonGradientClass: 'bg-gradient-to-b from-orange-500 to-red-600',
    buttonShadowClass: 'shadow-[0_6px_0_0_rgba(153,27,27,0.8)] active:shadow-[0_2px_0_0_rgba(153,27,27,0.8)]',
    glowClass: 'drop-shadow-[0_0_16px_rgba(248,113,113,0.8)]',
  },
}
