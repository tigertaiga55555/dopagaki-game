import { V4_SHARE_URL, buildShareText } from '../config/messagesV4'
import { isIOS } from './platform'
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
 * 1. navigator.canShare({files:[...]})でファイル共有が可能な場合：
 *    - iOS（Safari/WebKit）だけは専用の堅牢な経路を通る（isIOSRobustShare()参照）。
 *      iOS Safariでは、files+text+urlを同時に渡すとX（旧Twitter）等の共有先アプリ側で
 *      「共有先アプリへは遷移するが画像付き投稿まで進まず、Web Share API呼び出し自体が
 *      失敗扱いになる」という既知の不安定な挙動が実機で報告されたため、iOSだけはfilesのみを
 *      渡し、共有文＋URLは事前にクリップボードへコピーしておく（詳細は同関数コメント参照）。
 *    - iOS以外（Android Chrome等）は従来通りfiles＋text（URL込み）を同時に渡す
 *      （files指定時は一部環境でurlフィールドが無視されることがあるため、URLは必ずtextへ含める）。
 * 2. ファイル共有は無理でもnavigator.share自体はあるなら、テキスト＋URLの通常共有にフォールバックする。
 * 3. Web Share APIが全く無い環境では、共有文＋URLをクリップボードへコピーしつつ画像をダウンロードし、
 *    ユーザーがどちらの手段でも続きの共有ができる状態にする（詰まらせない）。
 * ユーザーがOSの共有シートを自分でキャンセルした場合（AbortError）はそのまま呼び出し元へ投げ、
 * 呼び出し元は「失敗」としてトースト表示しない判断ができるようにする（iOS専用経路でも同様）。
 */
export type ImageShareOutcome =
  | 'shared-with-image'
  | 'shared-with-image-ios'
  | 'shared-text-only'
  | 'fallback-copied'
  | 'ios-share-failed-fallback'

/**
 * Ver.5.0追加: iOS専用の画像共有経路。
 * 1. 共有文＋本番URLを先にクリップボードへコピーする（ネイティブ共有シートを開く前）。
 *    これにより、共有先アプリ側の投稿画面が空でも、ユーザーが手動で貼り付けられる。
 * 2. navigator.share({files:[file]})で画像ファイルだけを渡す（text/urlは含めない）。
 *    iOSのWeb Share APIはファイルと同時にtext/urlを渡すと共有先アプリによって不安定になる
 *    既知の問題があるため、iOSでは「画像だけを確実に共有先へ渡す」ことを優先する。
 * 3. ユーザーが共有シートを自分でキャンセルした場合（AbortError）はそのまま呼び出し元へ投げる
 *    （呼び出し元でトースト非表示の判断に使う）。
 * 4. それ以外の理由で共有自体が失敗した場合は、画像を保存へ自動フォールバックする
 *    （共有文は手順1で既にクリップボードにあるため再コピーは不要）。
 */
async function shareImageOnIOS(nav: Navigator, file: File, blob: Blob, fullText: string): Promise<ImageShareOutcome> {
  try {
    await navigator.clipboard.writeText(fullText)
  } catch {
    // クリップボードコピーが失敗しても、画像共有自体は試みる（詰まらせない）。
  }
  try {
    await nav.share({ files: [file] })
    return 'shared-with-image-ios'
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    downloadPngBlob(blob)
    return 'ios-share-failed-fallback'
  }
}

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
  if (canShareFiles && isIOS()) {
    return shareImageOnIOS(nav!, file, blob, fullText)
  }
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
