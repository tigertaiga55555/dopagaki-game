/**
 * Ver.6 Phase 5.2（Challenge機能完成）: Challenge URLの形式を1箇所に集約する。
 *
 * 本番（dopagakigame.com）ではまだChallenge機能のWorker APIが存在しないため、
 * 既存のシェア機能（utils/share.ts）のようにV4_SHARE_URL（本番URL固定）は使わず、
 * 常にwindow.location.origin（= 現在実際に動いているCloudflare Preview URL）を使う。
 * これにより、Preview環境でだけ正しく動くURLを共有する、という今回の制約を自然に満たす。
 */
const CHALLENGE_PATH_PREFIX = '/challenge/'

export function buildChallengeUrl(challengeId: string): string {
  return `${window.location.origin}${CHALLENGE_PATH_PREFIX}${challengeId}`
}

/** 現在のURL（pathname）がChallenge受信ページなら、そのchallengeIdを返す。それ以外はnull。 */
export function extractChallengeIdFromLocation(): string | null {
  const { pathname } = window.location
  if (!pathname.startsWith(CHALLENGE_PATH_PREFIX)) return null
  const id = pathname.slice(CHALLENGE_PATH_PREFIX.length).replace(/\/+$/, '')
  return id.length > 0 ? decodeURIComponent(id) : null
}
