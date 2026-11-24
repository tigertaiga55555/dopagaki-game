import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { SHARE_HASHTAG } from '../config/messagesV4'
import type { EndlessDifficulty } from '../types'

export type ShareResultInput =
  | { mode: 'rush'; percent: number; resultId: string; shareUrl: string }
  | { mode: 'endless'; difficulty: EndlessDifficulty; streak: number; resultId: string; shareUrl: string }

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: 結果画面側のコピー（既存の
 * config/messagesV4.ts buildShareTextと同じ「ドパガキ度○○％」トーン・SHARE_HASHTAGを
 * 1個だけ付与する規約）に揃えつつ、X専用の短い文面にする（既存のbuildShareTextは
 * 画像付き共有／Web Share API経路専用の、もっと長い文面のため使い回さない）。
 */
export function buildXShareText(input: ShareResultInput): string {
  if (input.mode === 'rush') {
    return `ドパガキ度${input.percent}％まで到達。お前は何％までいける？\n${SHARE_HASHTAG}`
  }
  return `ENDLESS ${ENDLESS_DIFFICULTY_LABEL[input.difficulty]} ${input.streak} STREAK。どこまで耐えられる？\n${SHARE_HASHTAG}`
}

/** X（旧Twitter）のWeb Intent（投稿画面を開くだけ、OAuth不要）のURLを組み立てる。 */
export function buildXIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

/**
 * 結果画面（ResultScreen.tsx/EndlessResultScreen.tsx）からシェア処理の中身を隠す
 * サービス境界。今回はXのWeb Intentをポップアップで開くだけだが、iOS化後に
 * ネイティブ共有シート／Universal Linksへ差し替える際、この関数の中身だけを
 * 書き換えれば済み、結果画面側のコードは一切変更不要にするための設計
 * （ユーザー指示: 「ResultScreen.tsx/EndlessResultScreen.tsxへ直接インラインしない」）。
 */
export function shareResult(input: ShareResultInput): void {
  const text = buildXShareText(input)
  const intentUrl = buildXIntentUrl(text, input.shareUrl)
  window.open(intentUrl, '_blank', 'noopener,noreferrer')
}

export type WebShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 97-99）: 「結果を共有」。OSの共有シート
 * （navigator.share、LINE/メッセージ/AirDrop/メール等）へ、結果テキスト（buildXShareText、
 * 「𝕏 結果をシェア」と同じmode別の文面を再利用——文面を2重実装しない）＋既存の
 * /s/:id共有URLを渡すだけの、shareResult()とは完全に独立した別経路。
 *
 * Share reward（Heart付与）・X Web Intent・動的OGPのいずれにも一切関与しない
 * ——「𝕏 結果をシェア」側（shareResult/grantShareRewardIfEligible）は無変更のまま。
 * navigator.shareが無い環境（主にデスクトップブラウザ）では、詰まらせないために
 * テキスト＋URLをクリップボードへコピーするフォールバックへ進む。
 */
export async function shareResultViaWebShare(input: ShareResultInput): Promise<WebShareOutcome> {
  const text = buildXShareText(input)
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ text, url: input.shareUrl })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
      // navigator.share自体が例外で失敗した場合も、下のクリップボードへのフォールバックへ進む。
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${input.shareUrl}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
