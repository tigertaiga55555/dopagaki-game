import { V4_SHARE_URL, buildShareText } from '../config/messagesV4'

type FinalTrialShareInfo = { trialsCleared: number; cleared200: boolean } | undefined

function getShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href
  }
  return V4_SHARE_URL
}

export function getShareText(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): string {
  return buildShareText(percent, typeName, finalTrial)
}

export async function shareResult(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): Promise<'native' | 'none'> {
  const text = getShareText(percent, typeName, finalTrial)
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

export function getXShareUrl(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): string {
  const text = getShareText(percent, typeName, finalTrial)
  const url = getShareUrl()
  const params = new URLSearchParams({ text, url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function getLineShareUrl(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): string {
  const text = getShareText(percent, typeName, finalTrial)
  const url = getShareUrl()
  const params = new URLSearchParams({ text: `${text}\n${url}` })
  return `https://social-plugins.line.me/lineit/share?${params.toString()}`
}

export async function copyShareText(percent: number, typeName: string, finalTrial?: FinalTrialShareInfo): Promise<boolean> {
  const text = `${getShareText(percent, typeName, finalTrial)}\n${getShareUrl()}`
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
