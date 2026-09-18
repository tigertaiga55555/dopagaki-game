/**
 * Ver.5.0追加: iOS（iPhone/iPod/iPad、iPadOS 13+のデスクトップ偽装UAも含む）判定を
 * 独立したhelperに切り出す。共有ロジック（share.ts）がこの判定だけを理由にiOS専用の
 * 分岐を持つため、判定ロジック自体をここに1箇所へ集約して読みやすく保つ。
 *
 * iPadOS 13以降はデフォルトでSafariのUser-Agentを「Macintosh」として送出するため、
 * UA文字列だけでは検出できない。navigator.platform === 'MacIntel'かつ
 * マルチタッチ対応（maxTouchPoints > 1、実際のMacには存在しない特徴）という
 * 定番の判定を組み合わせている。
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIPhoneOrIPod = /iPhone|iPod/.test(ua)
  const isIPadUA = /iPad/.test(ua)
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIPhoneOrIPod || isIPadUA || isIPadOS13Plus
}
