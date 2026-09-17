import { renderResultSharePng } from './shareCanvas'
import type { FinalResultV4 } from '../types'

/**
 * Ver.5.0追加修正: 共有PNGをresultデータから直接Canvas 2Dで描画する（shareCanvas.ts）。
 * 以前はResultCard本体のDOMをhtml-to-image（SVGのforeignObject経由）で画像化していたが、
 * 実機（iPhone Safari）で「カード右側に黒い矩形が写り込む」不具合が、box-shadow分離など
 * 複数回のDOM構造修正を経てもなお再発した。この不具合はforeignObject経由でのDOM→画像
 * 変換経路そのものに起因する、この開発環境（WebKitブラウザを起動できないサンドボックス）
 * からは直接再現・特定しきれないWebKit固有の問題と判断し、共有PNG生成をDOMキャプチャから
 * 完全に切り離してCanvas直接描画方式へ置き換えた（詳細はshareCanvas.tsの冒頭コメント参照）。
 * これにより、ライブ画面用のDOM（ResultScreen/ResultCard）を経由する必要が一切なくなった
 * （offscreen clone・box-shadow分離用のforCapture・キャプチャ用bleed paddingは全て不要になり
 * 削除済み）。
 */
export async function captureResultCardPng(result: FinalResultV4): Promise<Blob> {
  return renderResultSharePng(result)
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
