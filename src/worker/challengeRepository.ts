import type { ChallengeAttemptRecord, ChallengeRecord, CreateChallengeAttemptInput, CreateChallengeInput } from '../challenge/types'

/**
 * Ver.6 Phase 5.1（Challengeバックエンド基盤）: D1（SQLite互換）への実際のクエリだけを
 * 担当する層。Worker本体（index.ts）はこのインターフェースだけに依存させ、D1の
 * クエリ文字列・カラム名はこのファイルに閉じる（将来 players/ranking等のテーブルが
 * 増えても、Worker側のルーティングコードを変えずに済む）。
 *
 * プレースホルダ（?）を使ったbind()経由でのみ値を渡し、SQL文字列へ直接値を
 * 埋め込むことは一切しない（SQLインジェクション対策。ユーザー指示の
 * 「クライアント入力をそのまま信用しない」を、クエリ層でも徹底する）。
 */
export interface ChallengeRepository {
  create(id: string, createdAt: number, input: CreateChallengeInput): Promise<ChallengeRecord>
  getById(id: string): Promise<ChallengeRecord | null>
}

interface ChallengeRow {
  id: string
  creator_player_id: string
  creator_nickname: string
  creator_icon_kind: string
  creator_icon_value: string
  creator_equipped_title: string | null
  mode: string
  problem_set: string
  conditions: string
  creator_score: number
  created_at: number
}

function rowToRecord(row: ChallengeRow): ChallengeRecord {
  return {
    id: row.id,
    creatorPlayerId: row.creator_player_id,
    creatorNickname: row.creator_nickname,
    creatorIcon:
      row.creator_icon_kind === 'remoteCustom'
        ? { kind: 'remoteCustom', url: row.creator_icon_value }
        : { kind: 'preset', iconId: row.creator_icon_value as never },
    creatorEquippedTitle: row.creator_equipped_title,
    mode: row.mode as ChallengeRecord['mode'],
    problemSet: JSON.parse(row.problem_set),
    conditions: JSON.parse(row.conditions),
    creatorScore: row.creator_score,
    createdAt: row.created_at,
  }
}

export function createD1ChallengeRepository(db: D1Database): ChallengeRepository {
  return {
    async create(id, createdAt, input) {
      await db
        .prepare(
          `INSERT INTO challenges
            (id, creator_player_id, creator_nickname, creator_icon_kind, creator_icon_value,
             creator_equipped_title, mode, problem_set, conditions, creator_score, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          input.creatorPlayerId,
          input.creatorNickname,
          input.creatorIcon.kind,
          input.creatorIcon.kind === 'preset' ? input.creatorIcon.iconId : input.creatorIcon.url,
          input.creatorEquippedTitle,
          input.mode,
          JSON.stringify(input.problemSet),
          JSON.stringify(input.conditions),
          input.creatorScore,
          createdAt,
        )
        .run()

      return { id, createdAt, ...input }
    },

    async getById(id) {
      const row = await db.prepare(`SELECT * FROM challenges WHERE id = ?`).bind(id).first<ChallengeRow>()
      return row ? rowToRecord(row) : null
    },
  }
}

/**
 * Ver.6 Phase 5.2（Challenge機能完成）: challenge_attempts（挑戦履歴）のD1クエリ層。
 * ChallengeRepositoryと同じ方針（bind()経由のみ、SQL文字列へ値を直接埋め込まない）。
 */
export interface ChallengeAttemptRepository {
  /** 同一playerIdがこのchallengeIdへ何回目の挑戦かを数える（attemptNumberの算出に使う）。 */
  countForPlayer(challengeId: string, playerId: string): Promise<number>
  create(
    id: string,
    createdAt: number,
    attemptNumber: number,
    result: 'win' | 'lose',
    input: CreateChallengeAttemptInput,
  ): Promise<ChallengeAttemptRecord>
  /**
   * challengeIdへの挑戦履歴を新しい順に返す。playerIdを渡すとその挑戦者だけに絞る
   * （Challenge作成者が「挑戦者ごとの最新結果」を見る場合はplayerId省略→全件を日時降順で
   * 取得しアプリ側でplayerIdごとに集約、挑戦者本人が自分の履歴を見る場合はplayerId指定）。
   * limitは無料ユーザーの「直近10件」制限をサーバー側で実現するためのページング。
   * DBの行自体は一切削除しないため、将来DOPA PASSでlimitを外すだけで全履歴表示に拡張できる。
   */
  list(challengeId: string, options: { playerId?: string; limit: number }): Promise<{ rows: ChallengeAttemptRecord[]; totalCount: number }>
}

interface ChallengeAttemptRow {
  id: string
  challenge_id: string
  player_id: string
  nickname: string
  icon_kind: string
  icon_value: string
  equipped_title: string | null
  score: number
  result: string
  attempt_number: number
  created_at: number
}

function attemptRowToRecord(row: ChallengeAttemptRow): ChallengeAttemptRecord {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    playerId: row.player_id,
    nickname: row.nickname,
    avatar:
      row.icon_kind === 'remoteCustom' ? { kind: 'remoteCustom', url: row.icon_value } : { kind: 'preset', iconId: row.icon_value as never },
    equippedTitle: row.equipped_title,
    score: row.score,
    result: row.result as 'win' | 'lose',
    attemptNumber: row.attempt_number,
    createdAt: row.created_at,
  }
}

export function createD1ChallengeAttemptRepository(db: D1Database): ChallengeAttemptRepository {
  return {
    async countForPlayer(challengeId, playerId) {
      const row = await db
        .prepare(`SELECT COUNT(*) as cnt FROM challenge_attempts WHERE challenge_id = ? AND player_id = ?`)
        .bind(challengeId, playerId)
        .first<{ cnt: number }>()
      return row?.cnt ?? 0
    },

    async create(id, createdAt, attemptNumber, result, input) {
      await db
        .prepare(
          `INSERT INTO challenge_attempts
            (id, challenge_id, player_id, nickname, icon_kind, icon_value, equipped_title, score, result, attempt_number, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          input.challengeId,
          input.playerId,
          input.nickname,
          input.avatar.kind,
          input.avatar.kind === 'preset' ? input.avatar.iconId : input.avatar.url,
          input.equippedTitle,
          input.score,
          result,
          attemptNumber,
          createdAt,
        )
        .run()

      return { id, createdAt, attemptNumber, result, ...input }
    },

    async list(challengeId, options) {
      const countRow = await db
        .prepare(
          options.playerId
            ? `SELECT COUNT(*) as cnt FROM challenge_attempts WHERE challenge_id = ? AND player_id = ?`
            : `SELECT COUNT(*) as cnt FROM challenge_attempts WHERE challenge_id = ?`,
        )
        .bind(...(options.playerId ? [challengeId, options.playerId] : [challengeId]))
        .first<{ cnt: number }>()
      const totalCount = countRow?.cnt ?? 0

      const result = await db
        .prepare(
          options.playerId
            ? `SELECT * FROM challenge_attempts WHERE challenge_id = ? AND player_id = ? ORDER BY created_at DESC LIMIT ?`
            : `SELECT * FROM challenge_attempts WHERE challenge_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(...(options.playerId ? [challengeId, options.playerId, options.limit] : [challengeId, options.limit]))
        .all<ChallengeAttemptRow>()

      return { rows: (result.results ?? []).map(attemptRowToRecord), totalCount }
    },
  }
}
