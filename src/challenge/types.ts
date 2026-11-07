import type { AvatarRef, ChallengeProblemSetItem } from '../types'

/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: クライアント（Worker API呼び出し側）と
 * Worker（src/worker/）の両方から参照する、Challenge機能の共有型定義。
 *
 * このファイルはReact・DOM・Workersランタイムのいずれにも依存しない純粋な型定義のみを
 * 置く（既存のengine/*.tsと同じ方針）。これにより、クライアント側（将来のChallenge
 * 送信・結果画面UI）とWorker側（src/worker/index.ts）が同じ型を安全に共有できる。
 *
 * ChallengeProblemSetItem自体はtypes.ts（FinalResultV4.recordedProblemSetと同じ型）で
 * 定義し、ここではそれを再エクスポートするだけにする（循環import回避のため、
 * types.ts→challenge/types.tsの一方向依存に統一する）。
 */
export type { ChallengeProblemSetItem }

/** Challengeの元になったプレイモード。既存のFinalResultV4が持つ3つの経路に対応する。 */
export type ChallengeMode = 'normal' | 'finalTrial' | 'challenge500'

/** 保存形式のバージョン。将来問題データの形を変える場合はversionを上げて両対応する。 */
export interface ChallengeProblemSet {
  version: 1
  items: ChallengeProblemSetItem[]
}

/** プレイ条件。現時点ではmodeの重複保持のみ（将来、時間制限バリエーション等が増えたらここに追加する）。 */
export interface ChallengeConditions {
  mode: ChallengeMode
}

export interface ChallengeRecord {
  id: string
  creatorPlayerId: string
  creatorNickname: string
  creatorIcon: AvatarRef
  creatorEquippedTitle: string | null
  mode: ChallengeMode
  problemSet: ChallengeProblemSet
  conditions: ChallengeConditions
  creatorScore: number
  createdAt: number
}

export type CreateChallengeInput = Omit<ChallengeRecord, 'id' | 'createdAt'>

export type ChallengeApiError = 'invalid_input' | 'not_found' | 'not_configured' | 'internal_error'

export type ChallengeApiResult<T> = { ok: true; value: T } | { ok: false; error: ChallengeApiError; message: string }

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: 1回ぶんの挑戦結果。challenge_attemptsテーブルの
 * 1行に対応する。creatorEquippedTitle同様、挑戦者のプロフィールも「挑戦した時点」の
 * スナップショットとして保存する（後からニックネームを変えても過去の挑戦記録の表示は
 * 変わらない——challenges.creator_*と同じ非正規化方針）。
 */
export interface ChallengeAttemptRecord {
  id: string
  challengeId: string
  playerId: string
  nickname: string
  avatar: AvatarRef
  equippedTitle: string | null
  score: number
  result: 'win' | 'lose'
  attemptNumber: number
  createdAt: number
}

export type CreateChallengeAttemptInput = Omit<ChallengeAttemptRecord, 'id' | 'createdAt' | 'attemptNumber' | 'result'>

/**
 * 履歴一覧の1件。GET /api/challenges/:id/attemptsが返す形。
 * 無料ユーザーの「直近10件まで」制限はサーバー側のページング（limit）で実現し、
 * challenge_attempts自体は何件あっても削除しない（将来DOPA PASSで全件取得できるよう、
 * limitを外すだけで済む構造にする）。
 */
export interface ChallengeAttemptListResult {
  attempts: ChallengeAttemptRecord[]
  /** サーバー側のlimitに切り詰められて、まだ古い履歴が残っている場合true。 */
  truncated: boolean
}

/**
 * Ver.6 Phase 5.1: 将来の画面（Challenge作成/受諾UI）がこのインターフェースだけに
 * 依存するようにしておくことで、utils/playerStatsRepository.ts・utils/
 * rankingDataSource.ts（Ver.6 Phase 5）と同じ「local-first repository/interface」方針を
 * Challengeにも踏襲する。今回はサーバー実装（remoteChallengeDataSource.ts）だけが存在し、
 * ローカル実装は存在しない（Challengeはそもそも他人と共有する以上、サーバー抜きで
 * 成立しない機能のため）。
 */
export interface ChallengeDataSource {
  createChallenge(input: CreateChallengeInput): Promise<ChallengeApiResult<ChallengeRecord>>
  getChallenge(id: string): Promise<ChallengeApiResult<ChallengeRecord>>
  createAttempt(challengeId: string, input: CreateChallengeAttemptInput): Promise<ChallengeApiResult<ChallengeAttemptRecord>>
  /** limitを渡さない場合、サーバー既定（無料ユーザー相当の直近10件）で返る。 */
  getAttempts(challengeId: string, options?: { playerId?: string; limit?: number }): Promise<ChallengeApiResult<ChallengeAttemptListResult>>
}
