import { ENDLESS_DIFFICULTY_LABEL } from '../config/endlessConfig'
import { getDopaTypeName } from '../config/dopaType'
import { decodeResultSharePayload, type ResultSharePayload } from '../share/resultSharePayload'
import type { ChallengeMode } from '../challenge/types'
import type { EndlessDifficulty } from '../types'

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

/** 次フェーズ（item 90-92）: ogImageHtml.tsからも共有する、HTMLエスケープの1箇所化。 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * payloadから、その結果専用のOGPタイトル・説明文を組み立てる（DOPA%／難易度+STREAKを実際に含める）。
 * 次フェーズ（item 104-108、110）: DOPA RUSHはDOPA TYPE名（config/dopaType.tsの単一定義）を
 * 必ず含め、「お前」表現は使わない。
 */
export function buildResultOgpCopy(payload: ResultSharePayload): { title: string; description: string } {
  if (payload.mode === 'rush') {
    return {
      title: `ドパガキ度${payload.percent}％まで到達！ドパガキゲーム`,
      description: `60秒の超高速ミニゲームで${payload.percent}％に到達。${getDopaTypeName(payload.percent)}。あなたは何％までいける？`,
    }
  }
  const difficultyLabel = ENDLESS_DIFFICULTY_LABEL[payload.difficulty]
  return {
    title: `ENDLESS ${difficultyLabel} ${payload.streak} STREAK！ドパガキゲーム`,
    description: `ENDLESS（${difficultyLabel}）で${payload.streak}連続正解。どこまで耐えられる？`,
  }
}

/**
 * og:title/og:description/og:image/twitter:cardを含む最小限のHTMLドキュメントを組み立てる
 * 共通部分（/s/:id・/challenge/:idの両方から使う）。meta refreshで実際のSPAページへ即座に
 * 誘導するのも共通（誤検知で人間のブラウザが来ても詰まらせない）。
 */
function renderOgpHtmlDocument(args: { title: string; description: string; pageUrl: string; imageUrl: string }): string {
  const safeTitle = escapeHtml(args.title)
  const safeDescription = escapeHtml(args.description)
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<meta property="og:type" content="website" />
<meta property="og:url" content="${args.pageUrl}" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDescription}" />
<meta property="og:image" content="${args.imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="ja_JP" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDescription}" />
<meta name="twitter:image" content="${args.imageUrl}" />
<meta http-equiv="refresh" content="0; url=${args.pageUrl}" />
</head>
<body>
<p><a href="${args.pageUrl}">${safeTitle}</a></p>
</body>
</html>`
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
 *
 * 次フェーズ（item 90-91）: og:imageは静的な共通画像（og-image-v5.png）ではなく、
 * この結果専用に動的生成されるPNG（/s/:resultId/image.png、ogImageRenderer.ts）を指す。
 */
export function buildResultOgpHtml(origin: string, resultId: string): string | null {
  const payload = decodeResultSharePayload(resultId)
  if (!payload) return null
  const { title, description } = buildResultOgpCopy(payload)
  const encodedId = encodeURIComponent(resultId)
  return renderOgpHtmlDocument({
    title,
    description,
    pageUrl: `${origin}/s/${encodedId}`,
    imageUrl: `${origin}/s/${encodedId}/image.png`,
  })
}

/** /challenge/:idのOGPカード用に渡す、D1から取得済みのChallenge情報の最小限の形。 */
export interface ChallengeOgpSource {
  creatorNickname: string
  mode: ChallengeMode
  creatorScore: number
  endlessDifficulty?: EndlessDifficulty
}

/**
 * 次フェーズ（item 92）: /challenge/:idのOGPカード。通常の結果シェア（/s/:id）とは別の
 * 「挑戦状」フレーミングの文言にする——ゲームロジック（作成/参加/勝敗/履歴/URL構造）には
 * 一切触れない、OGPの文言・画像だけの差分。
 */
export function buildChallengeOgpHtml(origin: string, challengeId: string, source: ChallengeOgpSource): string {
  const isEndless = source.mode === 'endless' && source.endlessDifficulty !== undefined
  const statText = isEndless
    ? `ENDLESS ${ENDLESS_DIFFICULTY_LABEL[source.endlessDifficulty!]} ${source.creatorScore} STREAKに挑戦`
    : `${source.creatorScore}%に挑戦`
  const title = `挑戦状！${statText}——ドパガキゲーム`
  const description = `この記録、超えられる？${source.creatorNickname}が出した${
    isEndless ? `ENDLESS（${ENDLESS_DIFFICULTY_LABEL[source.endlessDifficulty!]}）${source.creatorScore} STREAK` : `${source.creatorScore}%`
  }に挑戦しよう。`
  const encodedId = encodeURIComponent(challengeId)
  return renderOgpHtmlDocument({
    title,
    description,
    pageUrl: `${origin}/challenge/${encodedId}`,
    imageUrl: `${origin}/challenge/${encodedId}/image.png`,
  })
}
