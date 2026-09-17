import { toBlob } from 'html-to-image'

/**
 * 結果カードDOM要素（ResultCardが公開するref先のノード）をそのままPNG画像化する。
 *
 * html2canvasではなくhtml-to-imageを採用しているのは、このプロジェクトのTailwind CSS v4が
 * 配色にoklch()／不透明度指定にcolor-mix()を多用しているため（例: text-amber-300や
 * text-white/70など）。html2canvasは独自にCSSをパースしてcanvasへ手描きする実装のため
 * oklch()/color-mix()を解釈できず、該当箇所が黒潰れ・透明になってしまう。html-to-imageは
 * 計算済みスタイルをSVGのforeignObjectへそのまま埋め込み、ブラウザ自身にレンダリングさせる
 * ため、oklch()/color-mix()を含む最新のCSS関数もブラウザがサポートしている限りそのまま
 * 正しく描画できる。
 *
 * ResultCard自体はCSSアニメーション（回転する虹色ボーダーのみ）を除き静止した見た目のため、
 * キャプチャのタイミングによる崩れは基本的に発生しない（回転リングは連続的な円環グラデーション
 * のため、どの角度で止めても見た目が破綻することはない）。
 *
 * Ver.5.0追加修正: 実機で「角丸の外側に白い領域が見える」不具合を確認した。原因は
 * ResultCardのbox-shadow（isMax時の3px白リング＋110px黄金グロー等）が要素自身の矩形の
 * 外側にはみ出して描画されるため、captureする矩形（ResultScreen側で用意した
 * ブリード用ラッパー、#0b0620で塗った余白込み）の端でその半透明グラデーションが
 * 切り取られ、透明ピクセルとして残っていたこと（多くのSNS/OSの共有・保存パイプラインは
 * 透明PNGを白背景に合成して表示するため「白い外周」に見える）。
 * ここでは念のためbackgroundColorをアプリ本体と同じ#0b0620に明示指定し、
 * 万一captureノード自体やその余白の外側に透過ピクセルが残っても、白ではなく
 * アプリの背景色で塗りつぶされるようにしている（主な修正はResultScreen側の
 * ブリードラッパーだが、これは二重の安全策）。
 *
 * Ver.5.0追加修正: 実機で「PNG右側・右下に黒い矩形領域が残る」不具合を確認した。
 * html-to-imageは内部でnode.clientWidth/clientHeightから自動でサイズを算出するが、
 * これをoptionsのwidth/height/canvasWidth/canvasHeightとして明示的に固定値で渡す
 * ことで、内部の自動計測（レイアウトのタイミングやサブピクセルの丸め方次第で
 * ブラウザ間・実機端末間で結果が変わり得る）に依存しない、決定的なサイズでの
 * キャプチャにした。加えて、captureを呼ぶ直前に1フレーム待つことで、直前の
 * Reactの再レンダー（結果が切り替わった直後など）がまだ反映しきっていない
 * 過渡的なレイアウト状態を読んでしまう可能性を排除している。
 */
export async function captureResultCardPng(node: HTMLElement): Promise<Blob> {
  // SNS共有に耐える解像度にするため、devicePixelRatio任せにせず最低2倍・最大3倍を保証する
  // （デスクトップ等のdevicePixelRatio=1環境でぼやけた画像になるのを防ぐ）。
  const pixelRatio = typeof window !== 'undefined' ? Math.min(3, Math.max(2, window.devicePixelRatio || 1)) : 2

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const rect = node.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)

  const blob = await toBlob(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: '#0b0620',
    width,
    height,
    canvasWidth: Math.round(width * pixelRatio),
    canvasHeight: Math.round(height * pixelRatio),
  })
  if (!blob) throw new Error('結果カード画像の生成に失敗しました')
  return blob
}

export function pngBlobToFile(blob: Blob, filename = 'dopagaki-result.png'): File {
  return new File([blob], filename, { type: 'image/png' })
}

/** 生成したPNG Blobをブラウザのダウンロード機構で保存する（共有とは独立した経路）。 */
export function downloadPngBlob(blob: Blob, filename = 'dopagaki-result.png'): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // オブジェクトURLはダウンロード起動後も少し生存させてから解放する（即時revokeだと
  // 一部ブラウザでダウンロードが失敗することがあるため）。
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
