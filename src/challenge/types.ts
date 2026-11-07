import type { AvatarRef } from '../types'

/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: クライアント（Worker API呼び出し側）と
 * Worker（src/worker/）の両方から参照する、Challenge機能の共有型定義。
 *
 * このファイルはReact・DOM・Workersランタイムのいずれにも依存しない純粋な型定義のみを
 * 置く（既存のengine/*.tsと同じ方針）。これにより、クライアント側（将来のChallenge
 * 送信・結果画面UI）とWorker側（src/worker/index.ts）が同じ型を安全に共有できる。
 *
 * 今回実装するのは「Challengeを作成する／IDから取得する」の2操作のみ（ユーザー指示の
 * 今回の最低目標）。challenge_attempts（挑戦履歴）はスキーマ（migrations/）だけ用意し、
 * このラウンドではAPI・型をまだ作り込まない（DB設計を雑にしてまで詰め込まない方針）。
 */

/** Challengeの元になったプレイモード。既存のFinalResultV4が持つ3つの経路に対応する。 */
export type ChallengeMode = 'normal' | 'finalTrial' | 'challenge500'

/**
 * 出題された1問を再現するための最小限の情報。既存の3つの問題体系
 * （QuestionSpec／FinalQuestionSpec／Challenge500QuestionSpec）はいずれも
 * {type, data} を核に持つ（targetTimeMs・tagsは体系によって有無が異なる）ため、
 * その共通部分だけをここで定義する。instanceId（1プレイごとのランタイムID）は
 * 保存対象に含めない——Challengeとして保存するのは「問題の並び」そのものであり、
 * 個々のプレイの識別子ではないため。
 */
export interface ChallengeProblemSetItem {
  type: string
  targetTimeMs?: number
  tags?: string[]
  data: Record<string, unknown>
}

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
}
