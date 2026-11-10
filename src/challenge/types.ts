import type { AvatarRef, ChallengePerformance, ChallengeProblemSetItem } from '../types'

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
export type { ChallengeProblemSetItem, ChallengePerformance }

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
  /**
   * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 作成者の基準performance。
   * このmigration以前に作成された既存Challengeにはnull（推測で埋めない）。
   * nullの場合、挑戦の勝敗判定はcreatorScoreだけを使った旧ルールにフォールバックする
   * （src/worker/index.ts参照）。
   */
  performance: ChallengePerformance | null
}

/** 新規作成時は必ずperformanceを持つ（nullを許可しない）。 */
export type CreateChallengeInput = Omit<ChallengeRecord, 'id' | 'createdAt' | 'performance'> & {
  performance: ChallengePerformance
}

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 勝敗を決めた比較項目。優先順位どおりに
 * finalDopaPercent→baseDopaPercent→accuracy→maxCombo→medianCorrectReactionMsで
 * 必ず比較し、ここまで全て同値なら'exactTie'（挑戦者LOSE＝作成者防衛）。
 * 'legacyScoreOnly'は、作成者のChallengeがこのmigration以前のものでperformanceを
 * 持たない場合のみ使う、creatorScoreだけを使った旧ルールへのフォールバック。
 */
export type ChallengeDecidedBy = 'finalDopaPercent' | 'baseDopaPercent' | 'accuracy' | 'maxCombo' | 'medianCorrectReactionMs' | 'exactTie' | 'legacyScoreOnly'

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
  /**
   * Ver.6 Phase 5.3: 挑戦者自身のperformance。クライアントの自己申告をサーバーが検証した
   * うえで保存する。このmigration以前に作成された既存attemptにはnull。
   */
  performance: ChallengePerformance | null
  /**
   * Ver.6 Phase 5.3: この挑戦の勝敗を決めた比較項目（サーバー側のcompareChallengePerformanceが
   * 確定）。既存attemptにはnull。
   */
  decidedBy: ChallengeDecidedBy | null
}

/** 新規submit時は必ずperformanceを持つ（nullを許可しない。result/decidedByはサーバーが確定するため入力に含めない）。 */
export type CreateChallengeAttemptInput = Omit<
  ChallengeAttemptRecord,
  'id' | 'createdAt' | 'attemptNumber' | 'result' | 'decidedBy' | 'performance'
> & { performance: ChallengePerformance }

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
  /**
   * Ver.6 Phase 5.3（送った挑戦状一覧）: 複数のChallenge IDの要約を一括取得する
   * （utils/createdChallengesStorage.tsが保持するcreatedChallengeIds向け）。
   */
  getSummaries(ids: string[]): Promise<ChallengeApiResult<ChallengeSummary[]>>
  /**
   * Ver.6 Phase 5.4（実機QA最終修正）: 複数のChallenge IDについて、playerId視点の
   * 要約（ホスト情報＋自分の挑戦結果）を一括取得する（utils/participatedChallengesStorage.tsが
   * 保持するparticipatedChallengeIds向け）。
   */
  getParticipatedSummaries(ids: string[], playerId: string): Promise<ChallengeApiResult<ParticipatedChallengeSummary[]>>
}

/**
 * Ver.6 Phase 5.3（送った挑戦状一覧）: POST /api/challenges/summariesが返す1件ぶんの要約。
 * ホストが「送った挑戦状」一覧で表示する最低限の情報（基準記録・挑戦者数・総attempt数・
 * 突破者数）だけを持つ、ChallengeRecordより軽量な形。
 */
export interface ChallengeSummary {
  id: string
  mode: ChallengeMode
  creatorScore: number
  createdAt: number
  /** 挑戦したユニークプレイヤー数。 */
  challengerCount: number
  /** 総attempt数（同一プレイヤーの複数回挑戦も全てカウント）。 */
  attemptCount: number
  /** 一度でもWINした（突破した）ユニークプレイヤー数。 */
  clearedCount: number
}

/**
 * Ver.6 Phase 5.4（実機QA最終修正）: POST /api/challenges/participated-summariesが返す1件ぶんの要約。
 * 「参加したChallenge」一覧（utils/participatedChallengesStorage.tsが保持する
 * participatedChallengeIds向け）で、自分が挑戦した相手（ホスト）の情報と、自分自身の
 * 挑戦結果（挑戦者視点のまま・反転しない）だけを持つ軽量な形。
 */
export interface ParticipatedChallengeSummary {
  id: string
  mode: ChallengeMode
  createdAt: number
  creatorNickname: string
  creatorIcon: AvatarRef
  creatorEquippedTitle: string | null
  creatorScore: number
  /** ホストの基準performance。このmigration以前のChallengeにはnull。 */
  hostPerformance: ChallengePerformance | null
  /** このChallengeへの自分の挑戦回数。 */
  myAttemptCount: number
  /** 自分の最新attemptのresult（挑戦者視点のまま）。 */
  myLatestResult: 'win' | 'lose'
}
