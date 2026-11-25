import type { AvatarRef, EndlessDifficulty } from '../types'
import type { ChallengeConditions, ChallengeProblemSet, CreateChallengeInput } from './types'

export interface EndlessChallengeHostProfile {
  playerId: string
  nickname: string
  icon: AvatarRef
  equippedTitleId: string | null
  /** 次フェーズ（item 157-159）: creatorEquippedTitleと同じスナップショット方式。 */
  subTitleIds: [string | null, string | null]
  hasPass: boolean
}

/**
 * ENDLESS Challenge作成入力を組み立てる純粋関数。
 *
 * Ver.6 Phase 10（実績拡張ラウンド）: 最低STREAK条件（旧: 初級10／中級5／上級3、
 * その前に検討した「全難易度1以上」も含む）は完全に撤廃した。0 STREAK（1問目で
 * 即終了した記録）でも必ずChallengeとして成立させる——高記録者だけの競争ではなく、
 * 低記録・クソプレイも「これ超えられる？」とネタ的に共有できることに価値がある、
 * というユーザー指示による。TARGET 0は特別扱いしない。挑戦者が0連続（1問目MISS）
 * ならDRAW、1連続以上（1問目正解）ならTARGETの0を超えるため即WIN——この判定は
 * challenge/performance.tsのcompareEndlessStreak（TARGET未満=LOSE／TARGET同数=DRAW／
 * TARGET超過=即WIN）がそのまま正しく扱う。TARGET=0専用の別ロジックは一切作らない。
 *
 * mode==='endless'のChallengeにはperformance概念が存在しないため常にnull、problemSetは
 * ホストが実際にそのプレイで出題された問題列をそのまま渡す（別random生成は禁止）。
 */
export function buildCreateEndlessChallengeInput(
  host: EndlessChallengeHostProfile,
  difficulty: EndlessDifficulty,
  hostStreak: number,
  problemSet: ChallengeProblemSet,
): CreateChallengeInput {
  const conditions: ChallengeConditions = { mode: 'endless', endlessDifficulty: difficulty }
  return {
    creatorPlayerId: host.playerId,
    creatorNickname: host.nickname,
    creatorIcon: host.icon,
    creatorEquippedTitle: host.equippedTitleId,
    creatorSubTitleIds: host.subTitleIds,
    creatorHasPass: host.hasPass,
    mode: 'endless',
    problemSet,
    conditions,
    creatorScore: hostStreak,
    performance: null,
  }
}
