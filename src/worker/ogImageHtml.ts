import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { escapeHtml } from './ogpCard'
import type { ChallengeMode } from '../challenge/types'
import type { EndlessDifficulty } from '../types'
import type { ResultSharePayload } from '../share/resultSharePayload'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 90-92）: /s/:id・/challenge/:id の
 * og:image（1200x630のPNG）を生成するための「見た目のHTML文字列」だけを組み立てる、
 * 純粋関数だけのファイル。
 *
 * 重要: このファイルは`workers-og`（satori/resvg-wasm、Cloudflare Workersランタイム
 * 専用）を一切importしない——これにより、vitest（Node環境、.wasmのimportを解決できない）
 * からでも安全にimportしてテストできる。実際の画像化（HTML文字列→PNG）は
 * ogImageRenderer.ts（Worker fetchハンドラ内でだけ使う、テストの import グラフには
 * 一切含めない）が担当する。
 *
 * satoriの制約に合わせ、子要素を持つ全ての要素に明示的な`display:flex`を指定し、
 * レイアウトはflexbox（position: absoluteは最小限）のみで組む。絵文字は使わない
 * （satoriの既定の絵文字処理は外部フェッチを伴うため、今回はテキストだけで表現する）。
 */

const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630

/** 3種類のOGP画像すべてに共通する外枠（1200x630、背景グラデーション、縦積みcolumn）。 */
function frame(accentBorderColor: string, backgroundGradient: string, body: string): string {
  return `<div style="display:flex;flex-direction:column;width:${IMAGE_WIDTH}px;height:${IMAGE_HEIGHT}px;background:${backgroundGradient};position:relative;">
<div style="display:flex;width:${IMAGE_WIDTH}px;height:14px;background:${accentBorderColor};"></div>
<div style="display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px 60px;">
${body}
</div>
<div style="display:flex;width:${IMAGE_WIDTH}px;height:14px;background:${accentBorderColor};"></div>
</div>`
}

function pillBadge(label: string, gradient: string, textColor = '#ffffff'): string {
  return `<div style="display:flex;padding:14px 36px;border-radius:999px;background:${gradient};color:${textColor};font-size:34px;font-weight:900;letter-spacing:6px;">${escapeHtml(label)}</div>`
}

const RUSH_BG = 'linear-gradient(135deg, #220f38 0%, #050208 75%)'
const RUSH_BORDER = 'linear-gradient(90deg, #d946ef, #9333ea)'
const CHALLENGE_BG = 'linear-gradient(135deg, #330a0a 0%, #050208 75%)'
const CHALLENGE_BORDER = 'linear-gradient(90deg, #ef4444, #f59e0b)'

/** DOPA RUSH（通常結果シェア）。パーセントの数値を最も目立たせる。 */
export function buildRushResultImageHtml(percent: number): string {
  const body = `<div style="display:flex;flex-direction:column;align-items:center;gap:22px;">
${pillBadge('DOPA RUSH', RUSH_BORDER)}
<div style="display:flex;font-size:260px;font-weight:900;color:#fbbf24;line-height:1;">${percent}%</div>
<div style="display:flex;font-size:40px;font-weight:900;color:#ffffff;">ドパガキ度 到達</div>
<div style="display:flex;font-size:26px;font-weight:700;color:rgba(255,255,255,0.55);">ドパガキゲーム — 60秒の超高速ミニゲーム</div>
</div>`
  return frame(RUSH_BORDER, RUSH_BG, body)
}

/** ENDLESS（通常結果シェア）。STREAK数値を最も目立たせ、難易度を実resultから反映する。DOPA RUSHとは色調・バッジ構成で明確に区別する。 */
export function buildEndlessResultImageHtml(difficulty: EndlessDifficulty, streak: number): string {
  const theme = ENDLESS_THEME[difficulty]
  const accentRgb = `rgb(${theme.colorRgb})`
  const accentGradient = `linear-gradient(90deg, rgb(${theme.colorRgb}), rgba(${theme.colorRgb}, 0.55))`
  const body = `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
<div style="display:flex;align-items:center;gap:18px;">
${pillBadge('ENDLESS', 'linear-gradient(90deg, #fbbf24, #f97316)', '#1a0e05')}
<div style="display:flex;padding:14px 30px;border-radius:999px;background:rgba(${theme.colorRgb},0.18);border:4px solid ${accentRgb};color:${accentRgb};font-size:30px;font-weight:900;letter-spacing:4px;">${escapeHtml(ENDLESS_DIFFICULTY_LABEL[difficulty])}</div>
</div>
<div style="display:flex;font-size:230px;font-weight:900;color:${accentRgb};line-height:1;margin-top:10px;">${streak}</div>
<div style="display:flex;font-size:56px;font-weight:900;color:#ffffff;letter-spacing:8px;">STREAK</div>
<div style="display:flex;font-size:26px;font-weight:700;color:rgba(255,255,255,0.55);margin-top:6px;">ドパガキゲーム — 1ミスまで、どこまで続けられる？</div>
</div>`
  return frame(accentGradient, RUSH_BG, body)
}

/** resultId（decodeResultSharePayloadの結果）から、モードに応じて正しい画像HTMLを組み立てる。 */
export function buildResultImageHtml(payload: ResultSharePayload): string {
  if (payload.mode === 'rush') return buildRushResultImageHtml(payload.percent)
  return buildEndlessResultImageHtml(payload.difficulty, payload.streak)
}

/**
 * 「挑戦状」（/challenge/:id）専用の画像。通常の結果シェア画像（紫＝RUSH／amber＝ENDLESS）とは
 * 意図的に異なる配色（赤〜amberの対戦的なトーン）＋「挑戦状」バッジで、一目で「挑戦状」だと
 * 分かる見た目にする。ゲームロジック（勝敗判定・URL構造等）には一切関与しない——見た目の
 * 組み立てだけを行う。
 */
export function buildChallengeImageHtml(
  creatorNickname: string,
  mode: ChallengeMode,
  creatorScore: number,
  endlessDifficulty?: EndlessDifficulty,
): string {
  const isEndless = mode === 'endless' && endlessDifficulty !== undefined
  const statLine = isEndless
    ? `<div style="display:flex;align-items:baseline;gap:16px;"><div style="display:flex;font-size:150px;font-weight:900;color:#fbbf24;line-height:1;">${creatorScore}</div><div style="display:flex;font-size:48px;font-weight:900;color:#ffffff;">STREAK</div></div>`
    : `<div style="display:flex;font-size:180px;font-weight:900;color:#fbbf24;line-height:1;">${creatorScore}%</div>`
  const subLabel = isEndless
    ? `ENDLESS ${escapeHtml(ENDLESS_DIFFICULTY_LABEL[endlessDifficulty!])} ${creatorScore} STREAKに挑戦`
    : `${creatorScore}%に挑戦`
  const body = `<div style="display:flex;flex-direction:column;align-items:center;gap:20px;">
${pillBadge('挑戦状', CHALLENGE_BORDER)}
<div style="display:flex;font-size:34px;font-weight:900;color:#ffffff;">${escapeHtml(creatorNickname)}の記録、超えられる？</div>
${statLine}
<div style="display:flex;font-size:32px;font-weight:900;color:#fca5a5;">${subLabel}</div>
<div style="display:flex;font-size:26px;font-weight:700;color:rgba(255,255,255,0.55);margin-top:4px;">ドパガキゲーム</div>
</div>`
  return frame(CHALLENGE_BORDER, CHALLENGE_BG, body)
}

export const OG_IMAGE_WIDTH = IMAGE_WIDTH
export const OG_IMAGE_HEIGHT = IMAGE_HEIGHT
