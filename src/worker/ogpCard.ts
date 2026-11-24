import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { decodeResultSharePayload, type ResultSharePayload } from '../share/resultSharePayload'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 82）: X等のリンクプレビュー用クローラーに
 * だけ、/s/:idのOGPカード（text-only、タイトル/説明に実際の数値入り）をサーバー側で
 * 返す。実際のユーザー（人間のブラウザ）は従来通り完全なSPA（screens/
 * ResultShareLandingScreen.tsx、resolveShareLandingDestination()の差し込み点つき）を
 * 受け取る——この判定（isCrawlerUserAgent）はその分岐のためだけに存在する。
 *
 * 判定対象: X（Twitterbot）・Facebook・Slack・Discord・LINE・WhatsApp・Telegram・
 * LinkedIn等、主要なリンクプレビュー/クローラーのUser-Agentシグネチャ。誤検知で人間の
 * ブラウザをここへ誘導しても実害は無い（HTMLにmeta refreshを仕込んであるため、0秒で
 * 実際のSPAへ遷移する）設計にしているため、やや広めに拾ってよい。
 */
const CRAWLER_UA_PATTERN =
  /bot|facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|pinterest|vkshare|redditbot|applebot|embedly|quora link preview|w3c_validator|skypeuripreview|line\/|line-poker|google.*snippet/i

export function isCrawlerUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false
  return CRAWLER_UA_PATTERN.test(userAgent)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** payloadから、その結果専用のOGPタイトル・説明文を組み立てる（DOPA%／難易度+STREAKを実際に含める）。 */
export function buildResultOgpCopy(payload: ResultSharePayload): { title: string; description: string } {
  if (payload.mode === 'rush') {
    return {
      title: `ドパガキ度${payload.percent}％まで到達！ドパガキゲーム`,
      description: `60秒の超高速ミニゲームで${payload.percent}％に到達。お前は何％までいける？`,
    }
  }
  const difficultyLabel = ENDLESS_DIFFICULTY_LABEL[payload.difficulty]
  return {
    title: `ENDLESS ${difficultyLabel} ${payload.streak} STREAK！ドパガキゲーム`,
    description: `ENDLESS（${difficultyLabel}）で${payload.streak}連続正解。どこまで耐えられる？`,
  }
}

/**
 * /s/:idのresultId（share/resultSharePayload.tsのencodeResultSharePayload結果そのもの）を
 * 受け取り、og:title/og:description/og:image/twitter:cardを含む最小限のHTMLを返す。
 * resultIdが壊れている/デコードできない場合はnullを返す（架空の結果をでっち上げない
 * ——呼び出し元はnullの場合、通常のSPA/404扱いへフォールバックする）。
 *
 * og:image/og:urlは常にこのリクエストの実際のorigin（＝今動いているCloudflare Preview
 * URL）を使う——index.htmlのアプリ全体向けOGP（本番URL固定）とは意図的に違う判断：
 * こちらは「この特定の結果ページへ実際に飛べるリンク」そのものが価値なので、Preview
 * URLを隠す理由がない（challenge/url.ts・share/resultShareUrl.tsが既にwindow.location.origin
 * を使っているのと同じ方針をサーバー側でも踏襲する）。
 */
export function buildResultOgpHtml(origin: string, resultId: string): string | null {
  const payload = decodeResultSharePayload(resultId)
  if (!payload) return null
  const { title, description } = buildResultOgpCopy(payload)
  const pageUrl = `${origin}/s/${encodeURIComponent(resultId)}`
  const imageUrl = `${origin}/og-image-v5.png`
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<meta property="og:type" content="website" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDescription}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="ja_JP" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDescription}" />
<meta name="twitter:image" content="${imageUrl}" />
<meta http-equiv="refresh" content="0; url=${pageUrl}" />
</head>
<body>
<p><a href="${pageUrl}">${safeTitle}</a></p>
</body>
</html>`
}
