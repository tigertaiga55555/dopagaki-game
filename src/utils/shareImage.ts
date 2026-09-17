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
 */
export async function captureResultCardPng(node: HTMLElement): Promise<Blob> {
  // SNS共有に耐える解像度にするため、devicePixelRatio任せにせず最低2倍・最大3倍を保証する
  // （デスクトップ等のdevicePixelRatio=1環境でぼやけた画像になるのを防ぐ）。
  const pixelRatio = typeof window !== 'undefined' ? Math.min(3, Math.max(2, window.devicePixelRatio || 1)) : 2
  const blob = await toBlob(node, { pixelRatio, cacheBust: true })
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
