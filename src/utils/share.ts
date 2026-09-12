import { GAME_CONFIG } from '../config/gameConfig'
import { buildShareText } from '../config/messages'

function getShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href
  }
  return GAME_CONFIG.shareUrl
}

export function getShareText(point: number, percent: number, rankName: string): string {
  return buildShareText(point, percent, rankName)
}

export async function shareResult(point: number, percent: number, rankName: string): Promise<'native' | 'none'> {
  const text = getShareText(point, percent, rankName)
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

export function getXShareUrl(point: number, percent: number, rankName: string): string {
  const text = getShareText(point, percent, rankName)
  const url = getShareUrl()
  const params = new URLSearchParams({ text, url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function getLineShareUrl(point: number, percent: number, rankName: string): string {
  const text = getShareText(point, percent, rankName)
  const url = getShareUrl()
  const params = new URLSearchParams({ text: `${text}\n${url}` })
  return `https://social-plugins.line.me/lineit/share?${params.toString()}`
}

export async function copyShareText(point: number, percent: number, rankName: string): Promise<boolean> {
  const text = `${getShareText(point, percent, rankName)}\n${getShareUrl()}`
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
