import { getProfile } from '../utils/profileStorage'
import type { ChallengeMode, CreateChallengeInput } from './types'
import type { FinalResultV4 } from '../types'

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: FinalResultV4のどのフィールドが埋まっているかから
 * Challengeのmodeを機械的に導出する。challenge500が存在すれば'challenge500'、
 * なければfinalTrialが存在すれば'finalTrial'、どちらもなければ'normal'
 * （この優先順位は、500%チャレンジが常にFINAL DOPA TRIAL 200%到達後にのみ存在しうる、
 * という既存のゲーム進行順そのものに対応する）。
 */
export function deriveChallengeMode(result: FinalResultV4): ChallengeMode {
  if (result.challenge500) return 'challenge500'
  if (result.finalTrial) return 'finalTrial'
  return 'normal'
}

/**
 * 結果画面の「挑戦状を送る」が呼ぶ、POST /api/challengesへ送る入力の組み立て。
 * Profile情報（player_id/nickname/avatar/equippedTitleId）はutils/profileStorage.ts
 * から読むだけで、Challenge専用の別管理は一切しない（ユーザー指示どおり）。
 */
export function buildCreateChallengeInput(result: FinalResultV4): CreateChallengeInput | null {
  const problemSet = result.recordedProblemSet
  // Ver.6 Phase 5.3（Challenge勝敗判定強化）: challengePerformanceが無い場合も
  // 「挑戦状を送る」自体を成立させない（推測値で埋めて送信することは絶対にしない）。
  if (!problemSet || problemSet.length === 0 || !result.challengePerformance) return null

  const profile = getProfile()
  const mode = deriveChallengeMode(result)

  return {
    creatorPlayerId: profile.playerId,
    creatorNickname: profile.nickname,
    creatorIcon: profile.avatar,
    creatorEquippedTitle: profile.equippedTitleId,
    mode,
    problemSet: { version: 1, items: problemSet },
    conditions: { mode },
    creatorScore: result.percent,
    performance: result.challengePerformance,
  }
}
