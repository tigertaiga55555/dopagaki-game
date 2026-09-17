import { V4_SHARE_URL, buildShareText } from '../config/messagesV4'
import { pngBlobToFile, downloadPngBlob } from './shareImage'

type FinalTrialShareInfo = { trialsCleared: number; cleared200: boolean } | undefined

/**
 * Ver.5.0追加修正: 共有URLは常にV4_SHARE_URL（本番URL）固定。window.location.hrefを
 * 参照していた旧実装は、Preview（?preview=finalquestion等）から実行した場合にそのURLが
 * そのまま共有されてしまう経路が存在したため、常に本番URLだけを返すよう変更した。
 */
export function getShareUrl(): string {
  return V4_SHARE_URL
}

export function getShareText(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): string {
  return buildShareText(percent, typeName, finalTrial)
}

/**
 * Ver.5.0追加: 共有文＋本番URLを1本のテキストにまとめたもの。「結果をコピー」と
 * 「画像付きでシェア」のファイル共有経路（一部環境ではnavigator.share呼び出し時に
 * urlフィールドがfilesと同時だと無視されることがあるため、textへ確実に含めておく）の
 * 両方で使う。
 */
export function getFullShareText(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): string {
  return `${getShareText(percent, typeName, finalTrial)}\n${getShareUrl()}`
}

/**
 * Ver.5.0追加: 「画像付きでシェア」の中核ロジック。
 * 1. navigator.canShare({files:[...]})でファイル共有が可能ならPNG＋共有文（URL込み）を共有する
 *    （files指定時は一部環境でurlフィールドが無視されることがあるため、URLは必ずtextへ含める）。
 * 2. ファイル共有は無理でもnavigator.share自体はあるなら、テキスト＋URLの通常共有にフォールバックする。
 * 3. Web Share APIが全く無い環境では、共有文＋URLをクリップボードへコピーしつつ画像をダウンロードし、
 *    ユーザーがどちらの手段でも続きの共有ができる状態にする（詰まらせない）。
 * ユーザーがOSの共有シートを自分でキャンセルした場合（AbortError）はそのまま呼び出し元へ投げ、
 * 呼び出し元は「失敗」としてトースト表示しない判断ができるようにする。
 */
export type ImageShareOutcome = 'shared-with-image' | 'shared-text-only' | 'fallback-copied'

export async function shareResultWithImage(
  blob: Blob,
  percent: number,
  typeName: string,
  finalTrial?: FinalTrialShareInfo,
): Promise<ImageShareOutcome> {
  const file = pngBlobToFile(blob)
  const fullText = getFullShareText(percent, typeName, finalTrial)

  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const canShareFiles = typeof nav?.canShare === 'function' && nav.canShare({ files: [file] })
  if (canShareFiles) {
    await nav!.share({ files: [file], text: fullText })
    return 'shared-with-image'
  }
  if (typeof nav?.share === 'function') {
    await nav.share({ text: getShareText(percent, typeName, finalTrial), url: getShareUrl() })
    return 'shared-text-only'
  }
  await navigator.clipboard.writeText(fullText)
  downloadPngBlob(blob)
  return 'fallback-copied'
}

export async function copyShareText(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): Promise<boolean> {
  const text = getFullShareText(percent, typeName, finalTrial)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
