import { V3_CONFIG } from '../config/gameConfigV3'
import { buildShareText } from '../config/messagesV3'

function getShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href
  }
  return V3_CONFIG.shareUrl
}

export function getShareText(percent: number, typeName: string, gameScore: number, crimeText?: string): string {
  return buildShareText(percent, typeName, gameScore, crimeText)
}

export async function shareResult(
  percent: number,
  typeName: string,
  gameScore: number,
  crimeText?: string,
): Promise<'native' | 'none'> {
  const text = getShareText(percent, typeName, gameScore, crimeText)
  const url = getShareUrl()

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'native'
    } catch {
      return 'none'
    }
  }
  return 'none'
}

export function getXShareUrl(percent: number, typeName: string, gameScore: number, crimeText?: string): string {
  const text = getShareText(percent, typeName, gameScore, crimeText)
  const url = getShareUrl()
  const params = new URLSearchParams({ text, url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function getLineShareUrl(percent: number, typeName: string, gameScore: number, crimeText?: string): string {
  const text = getShareText(percent, typeName, gameScore, crimeText)
  const url = getShareUrl()
  const params = new URLSearchParams({ text: `${text}\n${url}` })
  return `https://social-plugins.line.me/lineit/share?${params.toString()}`
}

export async function copyShareText(percent: number, typeName: string, gameScore: number, crimeText?: string): Promise<boolean> {
  const text = `${getShareText(percent, typeName, gameScore, crimeText)}\n${getShareUrl()}`
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
