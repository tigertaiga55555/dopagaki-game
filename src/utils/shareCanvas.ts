import { getBottomStatusLine, getResultCardVariant } from '../components/ResultCard'
import type { FinalResultV4 } from '../types'

/**
 * Ver.5.0追加修正: 共有PNG生成方式の全面変更（html-to-image廃止）。
 *
 * これまでhtml-to-imageでResultCard本体のDOMをSVGのforeignObject経由で画像化していたが、
 * 実機（iPhone Safari）で「カード右側に黒い矩形が写り込む」不具合が、box-shadow分離など
 * 複数回のDOM構造修正を経てもなお再発した。border-radius＋overflow:hidden＋box-shadowの
 * 組み合わせを避けても再発したことから、この不具合はforeignObject経由でのDOM→画像変換
 * 経路そのものに起因する、この環境からは特定しきれないWebKit固有の問題と判断した。
 *
 * そのため今回、共有PNG生成をDOMキャプチャから完全に切り離し、CanvasRenderingContext2Dの
 * 標準的な描画命令（背景・グラデーション・角丸矩形・テキスト・shadowBlur・線・絵文字グリフ）
 * だけを使って共有画像を直接描画する方式に変更した。foreignObject/SVG data URI/DOMクローンを
 * 一切経由しないため、この不具合が発生していた経路自体を構造的に排除できる。
 *
 * ライブ画面のResultCard（src/components/ResultCard.tsx）とは完全に独立した描画コードだが、
 * 表示する情報・CTA判定・変数の意味は共通のヘルパー（getResultCardVariant/
 * getBottomStatusLine）を再利用し、判定ロジックが2箇所でズレることを防いでいる。
 *
 * 設計上の注意: レイアウトの「高さ計算」と「実際の描画」を別々の式で独立に書くと、
 * 一方だけ直してもう一方を直し忘れて要素が重なる事故が起きやすい（実際に開発中発生した）。
 * そのため、この2つを同じ関数`layoutCard()`の1回のシーケンシャルな積み上げ処理として
 * 実装し、高さ計算時と描画時で完全に同じ増分ロジックを通るようにしている。
 */

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif'

const CARD_WIDTH = 320
const CARD_PADDING = 20
const CONTENT_WIDTH = CARD_WIDTH - CARD_PADDING * 2
const CARD_RADIUS = 28

const PAGE_BG = '#0b0620'

type Variant = 'normal' | 'overdrive' | 'max'

function getVariantId(result: FinalResultV4): Variant {
  const { isOverdrive, isMax } = getResultCardVariant(result)
  if (isMax) return 'max'
  if (isOverdrive) return 'overdrive'
  return 'normal'
}

/** バリアントごとのグロー半径に対して必要十分な、四辺均等のブリード（キャンバス自体の余白）。 */
function getOuterMargin(variant: Variant): number {
  if (variant === 'max') return 116
  return 70
}

function font(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${FONT_FAMILY}`
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacingはSafari 17+等の比較的新しいCanvas 2D APIのため、未対応環境では
  // 単に無視される（例外は投げない）安全なfeature detectionにする。
  try {
    ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`
  } catch {
    // 何もしない（未対応環境では字間なしで描画される）
  }
}

function resetShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'rgba(0,0,0,0)'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/** 手動でパスを組む角丸矩形（ctx.roundRect()に頼らない、最も互換性の高い実装）。 */
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/**
 * ASCII英数字・記号（GO/SKIP/回/秒などと組み合わさる数字・アルファベットの連続）は
 * 単語の途中で改行しない。CJK文字は1文字ずつ改行候補にする。
 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  const re = /[A-Za-z0-9.%]+|[^\s]/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) tokens.push(m[0])
  return tokens
}

/**
 * 最後の行が1〜3文字だけの「孤立行」になった場合、前の行から文字を1つずつ
 * 引き取ってバランスさせる（幅を大きく超えない範囲でのみ）。
 */
function balanceOrphanLine(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number): string[] {
  if (lines.length < 2) return lines
  const result = [...lines]
  let last = result[result.length - 1]
  const prevIdx = result.length - 2
  while (Array.from(last).length > 0 && Array.from(last).length <= 3 && result[prevIdx] && Array.from(result[prevIdx]).length > 1) {
    const prevChars = Array.from(result[prevIdx])
    const moved = prevChars.pop() as string
    const candidatePrev = prevChars.join('')
    const candidateLast = moved + last
    if (ctx.measureText(candidateLast).width > maxWidth * 1.2) break
    result[prevIdx] = candidatePrev
    last = candidateLast
  }
  result[result.length - 1] = last
  return result
}

function wrapParagraph(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (text.length === 0) return ['']
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const tokens = tokenize(text)
  const lines: string[] = []
  let current = ''
  for (const tok of tokens) {
    const trial = current + tok
    if (current.length > 0 && ctx.measureText(trial).width > maxWidth) {
      lines.push(current)
      current = tok
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return balanceOrphanLine(ctx, lines, maxWidth)
}

/** 既存の意味単位改行（\n）はそのまま尊重し、それでも幅に収まらない行だけを追加で折り返す。 */
function wrapTextForCanvas(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const p of paragraphs) lines.push(...wrapParagraph(ctx, p, maxWidth))
  return lines
}

const SPARKLE_POSITIONS_OVERDRIVE = [
  { x: 6, y: 12 },
  { x: 92, y: 20 },
  { x: 10, y: 78 },
  { x: 88, y: 70 },
  { x: 50, y: 6 },
]

const SPARKLE_POSITIONS_MAX = [
  { x: 8, y: 8, color: '#facc15' },
  { x: 90, y: 10, color: '#ffffff' },
  { x: 5, y: 45, color: '#5cc8ff' },
  { x: 93, y: 48, color: '#ff5757' },
  { x: 10, y: 88, color: '#7dfcae' },
  { x: 88, y: 86, color: '#b98bff' },
  { x: 50, y: 4, color: '#ffffff' },
  { x: 20, y: 96, color: '#facc15' },
  { x: 80, y: 96, color: '#5cc8ff' },
  { x: 96, y: 28, color: '#facc15' },
  { x: 4, y: 28, color: '#ff5757' },
]

const COIN_POSITIONS_MAX = [
  { x: 14, y: 18 },
  { x: 86, y: 22 },
  { x: 12, y: 62 },
  { x: 88, y: 60 },
]

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  weight: number,
  size: number,
  color: string,
  letterSpacingPx = 0,
) {
  ctx.font = font(weight, size)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  if (letterSpacingPx) setLetterSpacing(ctx, letterSpacingPx)
  ctx.fillText(text, centerX, y)
  if (letterSpacingPx) setLetterSpacing(ctx, 0)
}

function drawLeftText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, weight: number, size: number, color: string) {
  ctx.font = font(weight, size)
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, y)
}

/** ドパガキ度の巨大な数字＋小さい「％」を、ひとかたまりとして中央揃えする。 */
function drawPercent(ctx: CanvasRenderingContext2D, percent: number, centerX: number, y: number, color: string, glow: string) {
  const bigFont = font(900, 72)
  const smallFont = font(900, 30)
  ctx.font = bigFont
  const numText = String(percent)
  const numWidth = ctx.measureText(numText).width
  ctx.font = smallFont
  const pctWidth = ctx.measureText('％').width
  const totalWidth = numWidth + pctWidth
  const startX = centerX - totalWidth / 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = glow
  ctx.shadowBlur = 30
  ctx.fillStyle = color
  ctx.font = bigFont
  ctx.fillText(numText, startX, y)
  ctx.font = smallFont
  ctx.fillText('％', startX + numWidth, y)
  resetShadow(ctx)
}

interface CrimeLine {
  text: string
  bullet: boolean
}

interface CardContent {
  variant: Variant
  headerText: string
  headerColor: string
  headerSize: number
  percentColor: string
  percentGlow: string
  typeColor: string
  crimeLines: CrimeLine[]
  commentLines: string[]
}

function buildContent(ctx: CanvasRenderingContext2D, result: FinalResultV4): CardContent {
  const variant = getVariantId(result)
  const { isFinalTrial, isMax, isOverdrive } = getResultCardVariant(result)

  const headerText = isMax
    ? '🏆 PERFECT CLEAR!! 🏆'
    : isFinalTrial
      ? '⚡ FINAL DOPA TRIAL ⚡'
      : isOverdrive
        ? '⚡ DOPA OVERDRIVE ⚡'
        : 'ドパガキゲーム'
  const headerColor = isMax ? '#ffffff' : isOverdrive ? '#fcd34d' : '#f0abfc'
  const headerSize = isMax ? 14 : 12

  const percentColor = isOverdrive ? '#fcd34d' : result.percent >= 100 ? '#fde68a' : '#ffffff'
  const percentGlow = isMax ? 'rgba(250,204,21,0.9)' : 'rgba(217,70,239,0.5)'
  const typeColor = isOverdrive ? '#fde68a' : '#f0abfc'

  const crimeInnerWidth = CONTENT_WIDTH - 24 // p-3(12px)*2
  ctx.font = font(400, 12)
  const crimeLines: CrimeLine[] = []
  for (const raw of result.crimeRecords) {
    const wrapped = wrapTextForCanvas(ctx, raw, crimeInnerWidth - 14) // "・"ぶんの幅を差し引く
    wrapped.forEach((line, i) => crimeLines.push({ text: line, bullet: i === 0 }))
  }

  ctx.font = font(700, 14)
  const commentLines = wrapTextForCanvas(ctx, `「${result.comment}」`, CONTENT_WIDTH)

  return { variant, headerText, headerColor, headerSize, percentColor, percentGlow, typeColor, crimeLines, commentLines }
}

/**
 * カードの縦方向のレイアウトを1回のシーケンシャルな積み上げ処理として実行する。
 * mode='measure'ではctxへの描画を一切行わず、cursor(高さ)の積み上げだけを行う。
 * mode='draw'では同じ積み上げ処理の中で実際にfillText等を呼ぶ。
 * こうすることで「高さ計算の式」と「描画位置の式」が別々に書かれてズレる事故を防ぐ。
 */
interface LayoutResult {
  height: number
  /** 犯行記録ボックスのY範囲（カード先頭からの相対px）。装飾グリフがここに重ならないようにする。 */
  crimeBoxRange: { top: number; bottom: number } | null
}

function layoutCard(
  ctx: CanvasRenderingContext2D,
  result: FinalResultV4,
  content: CardContent,
  mode: 'measure' | 'draw',
  cardX: number,
  cardTop: number,
): LayoutResult {
  const centerX = cardX + CARD_WIDTH / 2
  const contentLeft = cardX + CARD_PADDING
  const draw = mode === 'draw'
  let cursor = CARD_PADDING
  let crimeBoxRange: { top: number; bottom: number } | null = null

  // ヘッダーバッジ
  cursor += content.headerSize
  if (draw) {
    if (content.variant === 'max') {
      ctx.save()
      ctx.shadowColor = 'rgba(250,204,21,0.9)'
      ctx.shadowBlur = 10
      drawCenteredText(ctx, content.headerText, centerX, cardTop + cursor, 900, content.headerSize, content.headerColor, 1.5)
      resetShadow(ctx)
      ctx.restore()
    } else {
      drawCenteredText(ctx, content.headerText, centerX, cardTop + cursor, 900, content.headerSize, content.headerColor, 1.5)
    }
  }

  // ドパガキ度ラベル
  cursor += 8 + 12
  if (draw) drawCenteredText(ctx, 'ドパガキ度', centerX, cardTop + cursor, 700, 12, 'rgba(255,255,255,0.4)')

  // 巨大percent（下端の余白込みで76pxぶん確保）
  cursor += 8 + 68
  if (draw) {
    drawPercent(ctx, result.percent, centerX, cardTop + cursor, content.percentColor, content.percentGlow)
  }

  // タイプ名
  cursor += 14 + 18
  if (draw) drawCenteredText(ctx, result.type.name, centerX, cardTop + cursor, 900, 18, content.typeColor)

  // FINAL DOPA TRIAL n/16
  if (result.finalTrial) {
    cursor += 6 + 14
    if (draw) {
      drawCenteredText(
        ctx,
        `FINAL DOPA TRIAL ${result.finalTrial.trialsCleared} / 16`,
        centerX,
        cardTop + cursor,
        900,
        14,
        'rgba(255,255,255,0.7)',
        0.5,
      )
    }
  }

  // 統計3列（最大COMBO / 最速反応 / 正答率）— ラベル行→値行の順に、両方ぶん高さを積む
  cursor += 18 + 10
  const statsLabelY = cursor
  cursor += 20
  const statsValueY = cursor
  if (draw) {
    const statLabels = [
      { label: '最大COMBO', value: String(result.maxCombo) },
      { label: '最速反応', value: result.fastestReactionMs !== null ? `${(result.fastestReactionMs / 1000).toFixed(2)}秒` : '--' },
      { label: '正答率', value: `${Math.round(result.accuracy * 100)}％` },
    ]
    const statGap = 16
    const statWidths = statLabels.map((s) => {
      ctx.font = font(700, 14)
      const valW = ctx.measureText(s.value).width
      ctx.font = font(700, 10)
      const labelW = ctx.measureText(s.label).width
      return Math.max(valW, labelW)
    })
    const statsTotalWidth = statWidths.reduce((a, b) => a + b, 0) + statGap * (statLabels.length - 1)
    let statX = centerX - statsTotalWidth / 2
    statLabels.forEach((s, i) => {
      const colCenter = statX + statWidths[i] / 2
      drawCenteredText(ctx, s.label, colCenter, cardTop + statsLabelY, 700, 10, 'rgba(255,255,255,0.4)')
      drawCenteredText(ctx, s.value, colCenter, cardTop + statsValueY, 700, 14, 'rgba(255,255,255,0.8)')
      statX += statWidths[i] + statGap
    })
  }
  cursor += 6 // 値行の下の余白(ディセンダぶん)

  // 犯行記録ボックス
  if (content.crimeLines.length > 0) {
    cursor += 16 // mt-4
    const boxTop = cursor
    const boxPad = 12
    let innerCursor = boxPad + 11 // ラベルのベースライン
    const labelBaselineOffset = innerCursor
    innerCursor += 4 + 18 // ラベルと1行目の間隔＋1行目ぶん
    const firstLineBaselineOffset = innerCursor
    for (let i = 1; i < content.crimeLines.length; i++) innerCursor += 18
    const boxHeight = innerCursor + 6 + boxPad // 最終行のディセンダぶん＋下padding

    if (draw) {
      const boxX = contentLeft
      const boxW = CONTENT_WIDTH
      roundedRectPath(ctx, boxX, cardTop + boxTop, boxW, boxHeight, 16)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fill()

      const innerX = boxX + boxPad
      drawLeftText(ctx, 'あなたの犯行記録', innerX, cardTop + boxTop + labelBaselineOffset, 700, 11, 'rgba(255,255,255,0.4)')
      let lineBaseline = boxTop + firstLineBaselineOffset
      for (const line of content.crimeLines) {
        const text = line.bullet ? `・${line.text}` : `　${line.text}`
        drawLeftText(ctx, text, innerX, cardTop + lineBaseline, 400, 12, 'rgba(255,255,255,0.8)')
        lineBaseline += 18
      }
    }
    crimeBoxRange = { top: boxTop, bottom: boxTop + boxHeight }
    cursor = boxTop + boxHeight
  }

  // 結果コメント
  cursor += 16 // mt-4
  for (const line of content.commentLines) {
    cursor += 20
    if (draw) drawCenteredText(ctx, line, centerX, cardTop + cursor, 700, 14, 'rgba(255,255,255,0.7)')
  }
  cursor += 2 // ディセンダぶん

  // 下部CTA
  cursor += 20 // mt-5
  cursor += 11
  if (draw) drawCenteredText(ctx, getBottomStatusLine(result.percent), centerX, cardTop + cursor, 700, 11, 'rgba(255,255,255,0.4)')
  cursor += 4 // ディセンダぶん

  cursor += CARD_PADDING
  return { height: cursor, crimeBoxRange }
}

function drawRainbowBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  // 静止画のため回転はしない、固定の虹色グラデーションで縁取りする（conic-gradientは使わず、
  // 対角線方向のlinearGradientでSafariの全バージョンで安定して描画できる構成にする）。
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h)
  gradient.addColorStop(0, '#ff5757')
  gradient.addColorStop(0.2, '#ffb347')
  gradient.addColorStop(0.4, '#fff27a')
  gradient.addColorStop(0.6, '#7dfcae')
  gradient.addColorStop(0.8, '#5cc8ff')
  gradient.addColorStop(1, '#b98bff')
  ctx.save()
  ctx.strokeStyle = gradient
  ctx.lineWidth = 3
  roundedRectPath(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.restore()
}

/** 装飾グリフのY座標(カード内相対px)が犯行記録ボックスに重なるかどうか。重なる場合は描画をスキップする。 */
function overlapsExcludedZone(yPercent: number, cardHeight: number, exclude: { top: number; bottom: number } | null): boolean {
  if (!exclude) return false
  const y = (cardHeight * yPercent) / 100
  const buffer = 10
  return y >= exclude.top - buffer && y <= exclude.bottom + buffer
}

function drawCardBackground(
  ctx: CanvasRenderingContext2D,
  variant: Variant,
  cardX: number,
  cardY: number,
  cardWidth: number,
  cardHeight: number,
  crimeBoxRange: { top: number; bottom: number } | null,
) {
  if (variant === 'max') {
    drawRainbowBorder(ctx, cardX - 4, cardY - 4, cardWidth + 8, cardHeight + 8, CARD_RADIUS + 4)
  }

  const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight)
  if (variant === 'max') {
    gradient.addColorStop(0, '#2e2408')
    gradient.addColorStop(1, '#120a02')
  } else if (variant === 'overdrive') {
    gradient.addColorStop(0, '#241606')
    gradient.addColorStop(1, '#0b0620')
  } else {
    gradient.addColorStop(0, '#1c1033')
    gradient.addColorStop(1, '#0b0620')
  }

  ctx.save()
  if (variant === 'max') {
    ctx.shadowColor = 'rgba(250,204,21,0.75)'
    ctx.shadowBlur = 110
  } else if (variant === 'overdrive') {
    ctx.shadowColor = 'rgba(250,204,21,0.35)'
    ctx.shadowBlur = 60
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 20
  }
  roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, CARD_RADIUS)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.restore()
  resetShadow(ctx)

  ctx.save()
  roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, CARD_RADIUS)
  ctx.lineWidth = variant === 'max' ? 3 : 1
  ctx.strokeStyle = variant === 'max' ? 'rgba(255,255,255,0.85)' : variant === 'overdrive' ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.08)'
  ctx.stroke()
  ctx.restore()

  ctx.save()
  roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, CARD_RADIUS)
  ctx.clip()
  if (variant === 'overdrive') {
    ctx.font = font(400, 14)
    ctx.fillStyle = 'rgba(252,211,77,0.8)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of SPARKLE_POSITIONS_OVERDRIVE) {
      if (overlapsExcludedZone(p.y, cardHeight, crimeBoxRange)) continue
      ctx.fillText('✦', cardX + (cardWidth * p.x) / 100, cardY + (cardHeight * p.y) / 100)
    }
  }
  if (variant === 'max') {
    ctx.font = font(400, 14)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of SPARKLE_POSITIONS_MAX) {
      if (overlapsExcludedZone(p.y, cardHeight, crimeBoxRange)) continue
      ctx.fillStyle = p.color
      ctx.fillText('✦', cardX + (cardWidth * p.x) / 100, cardY + (cardHeight * p.y) / 100)
    }
    ctx.font = font(400, 18)
    ctx.globalAlpha = 0.9
    for (const p of COIN_POSITIONS_MAX) {
      if (overlapsExcludedZone(p.y, cardHeight, crimeBoxRange)) continue
      ctx.fillText('🪙', cardX + (cardWidth * p.x) / 100, cardY + (cardHeight * p.y) / 100)
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1))
}

/**
 * 共有PNGをCanvas 2Dで直接描画してBlobを返す。DOMキャプチャ（html-to-image/html2canvas/
 * foreignObject）を一切経由しない。ライブ画面のResultScreen/ResultCardには一切触れない
 * （このファイルはそれらを読み込むが、描画は完全に独立している）。
 */
export async function renderResultSharePng(result: FinalResultV4): Promise<Blob> {
  const pixelRatio = typeof window !== 'undefined' ? Math.min(3, Math.max(2, window.devicePixelRatio || 1)) : 2

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Canvas 2D contextの取得に失敗しました')

  const content = buildContent(measureCtx, result)
  const variant = getVariantId(result)
  const margin = getOuterMargin(variant)
  const { height: cardHeight, crimeBoxRange } = layoutCard(measureCtx, result, content, 'measure', 0, 0)

  const totalWidth = CARD_WIDTH + margin * 2
  const totalHeight = cardHeight + margin * 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(totalWidth * pixelRatio)
  canvas.height = Math.round(totalHeight * pixelRatio)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D contextの取得に失敗しました')
  ctx.scale(pixelRatio, pixelRatio)

  ctx.fillStyle = PAGE_BG
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  const cardX = margin
  const cardY = margin
  drawCardBackground(ctx, variant, cardX, cardY, CARD_WIDTH, cardHeight, crimeBoxRange)
  layoutCard(ctx, result, content, 'draw', cardX, cardY)

  const blob = await canvasToBlob(canvas)
  if (!blob) throw new Error('結果カード画像の生成に失敗しました')
  return blob
}
