import { upsertPublicProfile } from '../friends/friendsClient'
import type { PublicProfileSnapshot } from '../friends/types'
import { qaLocalEntitlementRepository } from '../payment/entitlementRepository'
import { getOrCreatePlayerId, getProfile } from './profileStorage'
import { localPlayerStatsRepository } from './playerStatsRepository'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: フレンド一覧・フレンドの公開プロフィール
 * 画面に必要な「他人から見える最小限の情報」を、Workerのplayer_public_profilesへ
 * アップロードする。既存のChallenge作成時にcreatorNickname等をD1へスナップショットする
 * パターン（migrations/0001）をそのまま一般化したもので、新しい概念を持ち込んでいない。
 *
 * 誠実な既知のギャップ（最終報告書にも記載）: これは「本人が最後にアプリを開いた/
 * 保存した時点」のスナップショットのアップロードであり、ライブなリアルタイム同期では
 * ない。呼び出しているのは①アプリ起動時に1回、②プロフィール編集の保存時、
 * ③DOPA PASS購入直後、の3箇所だけ——毎プレイごとの同期は今回のラウンドでは
 * スコープ外（頻度を上げるのはサーバー負荷と実装コストに対して今回は見合わない
 * と判断した。将来、実際のアカウント基盤を導入する際に合わせて見直す）。
 */
export function buildPublicProfileSnapshot(): PublicProfileSnapshot {
  const profile = getProfile()
  const stats = localPlayerStatsRepository.getPlayerStats()
  return {
    nickname: profile.nickname,
    avatar: profile.avatar,
    equippedTitleId: profile.equippedTitleId,
    hasDopaPass: qaLocalEntitlementRepository.hasEntitlement('DOPA_PASS'),
    bestDopaPercent: stats.maxDopaPercent,
    endlessBeginnerBest: stats.endlessBeginnerBest,
    endlessIntermediateBest: stats.endlessIntermediateBest,
    endlessAdvancedBest: stats.endlessAdvancedBest,
    worldBattleWins: stats.worldBattleWins ?? 0,
    achievementCount: stats.achievementCount,
    updatedAt: Date.now(),
  }
}

/** 失敗しても画面には一切影響させない（fire-and-forget、friendsClient.ts自体がtry/catch済み）。 */
export function syncPublicProfile(): void {
  const playerId = getOrCreatePlayerId()
  void upsertPublicProfile(playerId, buildPublicProfileSnapshot())
}
