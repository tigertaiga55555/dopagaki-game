import type { EndlessDifficulty } from '../types'

/**
 * Ver.6 Phase 4.1（難易度再設計）〜Phase 7（ホーム/ENDLESS実機QA最終改善）: Endless
 * 初級/中級/上級の視覚テーマ。
 *
 * ユーザー指示: 「難易度を選んだ瞬間に、初級っぽい／中級っぽい／上級っぽいが視覚的に分かること」。
 * challenge500Theme.tsと同じ方針で、このファイルは純粋なデータ定義のみを行う（DOM・Reactに
 * 一切依存しない）。実際の適用は各画面（EndlessSelectScreen/EndlessPlayScreen/
 * EndlessResultScreen）がclassNameへそのまま埋め込むだけ。Tailwind CSS v4はプロジェクト内の
 * 全ソースファイル（.tsも含む）を自動スキャンするため、ここに書いた完全なクラス名文字列も
 * 問題なく生成対象になる（動的な文字列結合は一切していない）。
 *
 * Phase 7で実機QAにより確定した最終配色（以前の薄い印象を減らし、明るく濃く発光感のある
 * 方向へ寄せた。また英語ムードラベルをFLOW/FOCUS/DANGER→EASY/HARD/DANGERへ変更。
 * DANGERのみ「現状ユーザーにも分かりやすい」として維持）:
 *   初級 = 明るい緑系（EASY）
 *   中級 = 黄色〜オレンジ系（HARD）——以前の青〜シアン系（FOCUS）から変更
 *   上級 = 赤系（DANGER）——以前のオレンジ寄りの配色から、より明確な赤主体へ変更
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
    mood: 'EASY',
    colorRgb: '74, 222, 128',
    textClass: 'text-green-300',
    cardClass: 'border-2 border-green-400/60 bg-green-500/20',
    timerBarClass: 'bg-green-400/90',
    buttonGradientClass: 'bg-gradient-to-b from-green-400 to-emerald-600',
    buttonShadowClass:
      'shadow-[0_6px_0_0_rgba(21,128,61,0.9),0_0_20px_3px_rgba(74,222,128,0.4)] active:shadow-[0_2px_0_0_rgba(21,128,61,0.9)]',
    glowClass: 'drop-shadow-[0_0_18px_rgba(74,222,128,0.85)]',
  },
  intermediate: {
    id: 'intermediate',
    mood: 'HARD',
    colorRgb: '251, 146, 60',
    textClass: 'text-amber-300',
    cardClass: 'border-2 border-amber-400/60 bg-amber-500/20',
    timerBarClass: 'bg-amber-400/90',
    buttonGradientClass: 'bg-gradient-to-b from-amber-300 to-orange-600',
    buttonShadowClass:
      'shadow-[0_6px_0_0_rgba(154,52,18,0.9),0_0_20px_3px_rgba(251,191,36,0.45)] active:shadow-[0_2px_0_0_rgba(154,52,18,0.9)]',
    glowClass: 'drop-shadow-[0_0_18px_rgba(251,191,36,0.9)]',
  },
  advanced: {
    id: 'advanced',
    mood: 'DANGER',
    colorRgb: '248, 113, 113',
    textClass: 'text-red-300',
    cardClass: 'border-2 border-red-400/60 bg-red-600/25',
    timerBarClass: 'bg-red-400/90',
    buttonGradientClass: 'bg-gradient-to-b from-red-500 to-red-800',
    buttonShadowClass:
      'shadow-[0_6px_0_0_rgba(127,29,29,0.9),0_0_20px_3px_rgba(248,113,113,0.5)] active:shadow-[0_2px_0_0_rgba(127,29,29,0.9)]',
    glowClass: 'drop-shadow-[0_0_18px_rgba(248,113,113,0.9)]',
  },
}
