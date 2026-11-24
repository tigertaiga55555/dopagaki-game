import { ImageResponse } from 'workers-og'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './ogImageHtml'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 90-92）: ogImageHtml.tsが組み立てた
 * HTML文字列を、実際のPNG画像（Response）へ変換する薄いラッパー。
 *
 * 重要: `workers-og`（内部でsatori・resvg-wasm・yoga-wasmを使う）をimportするのは
 * このファイルだけにする——Cloudflare Workers（wrangler dev/deployのesbuildバンドラ、
 * `.wasm`のimportをWebAssembly.Moduleとして自動解決する）専用の経路であり、vitest
 * （Node環境、.wasmのimport解決手段を持たない）からは一切importしない。
 * ogImageHtml.test.tsはHTML文字列の内容だけを検証し、このファイル（実際のラスタライズ）
 * はwrangler dev実機での検証に委ねる——既存のvitestスイートを壊さないための設計。
 *
 * 日本語テキストの描画には、satoriの既定フォント（ラテン文字のみ）ではCJKグリフが
 * 無いため、Google FontsのサブセットAPI（実際に描画するテキストだけを渡し、その分だけの
 * 軽量なフォントファイルを取得する——フォント全体を同梱しない）を使う。
 *
 * 次フェーズ（item 90-92、実機検証で発見）: `workers-og`が同梱するloadGoogleFontには、
 * text引数をURLへ埋め込む際にencodeURIComponent()し忘れているバグがある
 * （実際にwrangler dev実機で検証したところ、日本語テキストを渡しても常に極小
 * ——Latin文字だけの——フォントしか返らず、結果として生成画像のCJK文字が
 * 欠落グリフ（豆腐□）になることを確認した）。そのため、同じGoogle Fonts
 * サブセットAPIを、正しくURLエンコードする形で自前で呼び出す（loadGoogleFontは使わない）。
 */
async function loadSubsettedGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`
  const cssRes = await fetch(cssUrl, {
    headers: {
      // Google FontsはモダンブラウザUAにはwoff2（resvgが未対応）を返すため、既存のworkers-og実装と
      // 同じ「古いSafari」UAを使い、ttf/otfを返させる（resvg-wasmが直接読み込める形式）。
      'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  })
  const css = await cssRes.text()
  const fontUrl = /src: url\((.+)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1]
  if (!fontUrl) throw new Error('Could not find font URL in Google Fonts response')
  const fontRes = await fetch(fontUrl)
  return fontRes.arrayBuffer()
}

/** タグを取り除き、実際に描画される文字だけを残す（フォントサブセットの対象文字集合に渡す）。改行はスペースへ統一する。 */
function extractVisibleText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

export async function renderOgImagePng(html: string): Promise<Response> {
  const fontData = await loadSubsettedGoogleFont('Noto Sans JP', 900, extractVisibleText(html))
  return new ImageResponse(html, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts: [{ name: 'Noto Sans JP', data: fontData, weight: 900, style: 'normal' }],
    headers: { 'cache-control': 'public, max-age=86400' },
  })
}
