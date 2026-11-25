import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { ENDLESS_THEME } from '../config/endlessTheme'
import { getDopaTypeName } from '../config/dopaType'
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

/**
 * 3種類のOGP画像すべてに共通する外枠（1200x630、背景グラデーション、縦積みcolumn）。
 * `padding`は省略時（RUSH/ENDLESS通常結果シェア、従来どおり）"40px 60px"のまま——
 * 次フェーズ（item 102）でChallenge専用カードだけに非対称パディングを渡せるようにした。
 */
function frame(accentBorderColor: string, backgroundGradient: string, body: string, padding = '40px 60px'): string {
  return `<div style="display:flex;flex-direction:column;width:${IMAGE_WIDTH}px;height:${IMAGE_HEIGHT}px;background:${backgroundGradient};position:relative;">
<div style="display:flex;width:${IMAGE_WIDTH}px;height:14px;background:${accentBorderColor};"></div>
<div style="display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:${padding};">
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

/**
 * DOPA RUSH（通常結果シェア）。パーセントの数値を最も目立たせる。
 * 次フェーズ（item 104-108、111）: DOPA%のすぐ下にDOPA TYPE名（config/dopaType.tsの
 * 単一定義）を表示する——従来の固定文言「ドパガキ度 到達」をTYPE名で置き換える形にし、
 * 「一目で分かる位置」に収めつつ行を増やさない。巨大なパーセント数値（260px）の直後に
 * 補足文言を置くと詰まって見えることを#102で確認済みのため、ここでもmargin-topで
 * 明示的な余白を確保する（配色・バッジ・フォント・紫黒金デザインは変更していない）。
 */
export function buildRushResultImageHtml(percent: number): string {
  /**
   * 次フェーズ（item 108, 111、実機で発見）: satori（resvg-wasm経由でのラスタライズ）は、
   * 巨大なfont-sizeを持つ「テキストだけを直接含むdisplay:flexの葉要素」について、
   * 親のflex gap・その要素自身のmarginのいずれも次の兄弟要素との間へ正しく反映しない
   * （実機のPNGで確認：gap/marginの値を変えても次の要素と視覚的に詰まる/重なる）。
   * 各テキスト行を「余白だけを持つ外側div」と「文字だけを持つ内側div」の2重構造にする
   * ことで、gapが正しく空くことを実機で確認済み（デザイン・配色・文言は変更していない）。
   */
  const body = `<div style="display:flex;flex-direction:column;align-items:center;gap:22px;">
${pillBadge('DOPA RUSH', RUSH_BORDER)}
<div style="display:flex;"><div style="display:flex;font-size:220px;font-weight:900;color:#fbbf24;line-height:1;">${percent}%</div></div>
<div style="display:flex;"><div style="display:flex;font-size:40px;font-weight:900;color:#ffffff;">${escapeHtml(getDopaTypeName(percent))}</div></div>
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
 *
 * 次フェーズ（item 147、大型最終仕上げラウンド）: 「margin微調整の積み重ねは禁止、構造を
 * 根本から見直せ」というユーザー指示により、それまでの積み重ね式の余白調整をやめ、
 * 1200x630内で完全に固定された6行の縦構造として組み直した——
 *   上部: 挑戦状バッジ
 *   中上部: 「{nickname}の記録、超えられる？」
 *   中央: 記録値（数字だけの巨大テキスト。%やSTREAKの単位は含めない）
 *   中央下: 単位ラベル（「%」または「STREAK」）
 *   下部: モード/難易度（「DOPA RUSH」または「ENDLESS {難易度}」）
 *   最下部: 「ドパガキゲーム」
 * DOPA RUSH系・ENDLESS系のどちらでも全く同じ6行構成・同じgap・同じフォントサイズを使う
 * （「DOPA RUSH Challenge / ENDLESS Challenge両方で共通の安全な構造を使うこと」という
 * 指示どおり）。巨大な数字と単位ラベルは必ず別の行（縦積み）にし、satoriの既知の制約
 * （巨大なfont-sizeを持つ葉要素は、横並びの兄弟との間隔・揃えが正しく計算されない）を
 * 避ける——数字自体も「余白だけの外側div＋文字だけの内側div」の2重構造にして、gapの
 * 計算を安全にする（buildRushResultImageHtmlと同じ、実機で確認済みのパターン）。
 * relative/absolute position・transformは一切使わない（frame()自体のposition:relativeを
 * 除く——これは外枠のみで、中のテキスト要素には使わない）。桁数が変わっても中央位置が
 * 動かないよう、数字の文字幅ではなく「行数」で高さが決まる縦積みflexboxだけで組む
 * （0・3桁・500%のいずれでも、各行の高さ自体は変わらないため中心は動かない）。
 */
export function buildChallengeImageHtml(
  creatorNickname: string,
  mode: ChallengeMode,
  creatorScore: number,
  endlessDifficulty?: EndlessDifficulty,
): string {
  const isEndless = mode === 'endless' && endlessDifficulty !== undefined
  const unitLabel = isEndless ? 'STREAK' : '%'
  const modeLabel = isEndless ? `ENDLESS ${escapeHtml(ENDLESS_DIFFICULTY_LABEL[endlessDifficulty!])}` : 'DOPA RUSH'

  const body = `<div style="display:flex;flex-direction:column;align-items:center;gap:20px;">
${pillBadge('挑戦状', CHALLENGE_BORDER)}
<div style="display:flex;font-size:34px;font-weight:900;color:#ffffff;">${escapeHtml(creatorNickname)}の記録、超えられる？</div>
<div style="display:flex;"><div style="display:flex;font-size:150px;font-weight:900;color:#fbbf24;line-height:1;">${creatorScore}</div></div>
<div style="display:flex;font-size:44px;font-weight:900;color:#ffffff;letter-spacing:4px;">${unitLabel}</div>
<div style="display:flex;font-size:30px;font-weight:900;color:#fca5a5;letter-spacing:2px;">${modeLabel}</div>
<div style="display:flex;font-size:26px;font-weight:700;color:rgba(255,255,255,0.55);">ドパガキゲーム</div>
</div>`
  return frame(CHALLENGE_BORDER, CHALLENGE_BG, body, '44px 68px 44px')
}

export const OG_IMAGE_WIDTH = IMAGE_WIDTH
export const OG_IMAGE_HEIGHT = IMAGE_HEIGHT
