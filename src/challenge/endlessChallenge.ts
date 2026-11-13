import type { AvatarRef, EndlessDifficulty } from '../types'
import type { ChallengeConditions, ChallengeProblemSet, CreateChallengeInput } from './types'

/**
 * Ver.6 Phase 8（ENDLESS Challenge）: 低すぎるChallenge作成を防ぐための最低STREAK数。
 * クライアント（結果画面のボタン表示判定）・サーバー（src/worker/validation.ts）の
 * 両方からこの1つの定数だけを参照する（2箇所に同じ数字を独立に書いて食い違う事態を防ぐ）。
 */
export const ENDLESS_CHALLENGE_MIN_STREAK: Record<EndlessDifficulty, number> = {
  beginner: 10,
  intermediate: 5,
  advanced: 3,
}

export function meetsEndlessChallengeMinStreak(difficulty: EndlessDifficulty, streak: number): boolean {
  return streak >= ENDLESS_CHALLENGE_MIN_STREAK[difficulty]
}

export interface EndlessChallengeHostProfile {
  playerId: string
  nickname: string
  icon: AvatarRef
  equippedTitleId: string | null
}

/**
 * ENDLESS Challenge作成入力を組み立てる純粋関数。最低STREAK数未満ならnullを返す
 * （結果画面はnullの場合「挑戦状を送る」ボタン自体を表示しない、というUXをここで強制する）。
 * mode==='endless'のChallengeにはperformance概念が存在しないため常にnull、problemSetは
 * ホストが実際にそのプレイで出題された問題列をそのまま渡す（別random生成は禁止）。
 */
export function buildCreateEndlessChallengeInput(
  host: EndlessChallengeHostProfile,
  difficulty: EndlessDifficulty,
  hostStreak: number,
  problemSet: ChallengeProblemSet,
): CreateChallengeInput | null {
  if (!meetsEndlessChallengeMinStreak(difficulty, hostStreak)) return null
  const conditions: ChallengeConditions = { mode: 'endless', endlessDifficulty: difficulty }
  return {
    creatorPlayerId: host.playerId,
    creatorNickname: host.nickname,
    creatorIcon: host.icon,
    creatorEquippedTitle: host.equippedTitleId,
    mode: 'endless',
    problemSet,
    conditions,
    creatorScore: hostStreak,
    performance: null,
  }
}
