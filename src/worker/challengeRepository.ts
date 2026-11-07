import type { ChallengeRecord, CreateChallengeInput } from '../challenge/types'

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
