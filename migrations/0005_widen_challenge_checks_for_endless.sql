-- Ver.6 Phase 8（ENDLESS Challenge）: challenges.mode へ'endless'を、
-- challenge_attempts.result へ'draw'を追加で許可する（通常Challengeの新しい
-- 「完全同値はDRAW」ルールにも必要）。
--
-- SQLiteはCHECK制約だけを後から緩めるALTER文を持たない（ADD COLUMNしかできない）ため、
-- 標準的な「テーブル再作成」手順でCHECKだけを広げる。既存行は一切変換せず、
-- そのままコピーするだけ（データの推測変換はしない。新しいmode/result値は
-- このmigration以降に作られる新規行だけが持つ）。
-- 他の列・既存データ・既存のperformance_*列は一切変更しない。
--
-- 次フェーズ（ENDLESS Challenge作成失敗の実機不具合調査）で判明した事実：当初の実装は
-- 冒頭で`PRAGMA foreign_keys = OFF`を発行してから`DROP TABLE challenges`していたが、
-- SQLiteの仕様上`PRAGMA foreign_keys`はトランザクション内では変更できない
-- （No-opで静かに無視される）。`wrangler d1 migrations apply`は1ファイルを1トランザクションで
-- 実行するため、このPRAGMAは実際には一切効いておらず、まだchallenge_attempts（旧テーブル）
-- からFK参照されているchallengesを`DROP TABLE`した時点で
-- `FOREIGN KEY constraint failed (SQLITE_CONSTRAINT_FOREIGNKEY)`となり、このmigrationは
-- 実際のリモートD1上では一度も成功していなかった（ローカルのwrangler/D1エミュレーションは
-- デフォルトでforeign_keys enforcementが無効なため、ローカルでは問題なく「成功」して見え、
-- この不整合に気づけなかった）。結果としてmode='endless'のCHECK制約緩和が本番Preview
-- D1へ一度も反映されず、ENDLESS Challengeの作成が（STREAK数に関係なく）常にD1の
-- CHECK制約違反で失敗していた。
--
-- 修正方針：PRAGMAに依存せず、SQLite標準のFK整合性だけで安全な順序に組み直す。
-- 「まだ何かから参照されているテーブルをDROPしない」という制約そのものを満たすため、
-- 新しいchallenge_attempts_newを（旧challengesをDROPする前に）先にchallenges_newへの
-- 参照で作成・移行してしまい、古いchallenge_attempts・古いchallengesの両方を
-- 「どちらも既に何からも参照されなくなった後」でDROPする。SQLiteはテーブルの
-- RENAME時、他テーブルのREFERENCES句の参照先テーブル名も自動的に追従させるため
-- （legacy_alter_table=OFFが既定のモダンなSQLite/D1の挙動）、
-- challenge_attempts_newのREFERENCES challenges_new (id)は、challenges_newを
-- challengesへRENAMEした時点で自動的にREFERENCES challenges (id)へ更新される。

CREATE TABLE challenges_new (
  id TEXT PRIMARY KEY,
  creator_player_id TEXT NOT NULL,
  creator_nickname TEXT NOT NULL,
  creator_icon_kind TEXT NOT NULL CHECK (creator_icon_kind IN ('preset', 'remoteCustom')),
  creator_icon_value TEXT NOT NULL,
  creator_equipped_title TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('normal', 'finalTrial', 'challenge500', 'endless')),
  problem_set TEXT NOT NULL,
  conditions TEXT NOT NULL,
  creator_score REAL NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  performance_final_dopa_percent REAL,
  performance_base_dopa_percent REAL,
  performance_accuracy REAL,
  performance_max_combo INTEGER,
  performance_median_reaction_ms REAL
);

INSERT INTO challenges_new
  (id, creator_player_id, creator_nickname, creator_icon_kind, creator_icon_value, creator_equipped_title,
   mode, problem_set, conditions, creator_score, created_at, expires_at,
   performance_final_dopa_percent, performance_base_dopa_percent, performance_accuracy,
   performance_max_combo, performance_median_reaction_ms)
SELECT
  id, creator_player_id, creator_nickname, creator_icon_kind, creator_icon_value, creator_equipped_title,
  mode, problem_set, conditions, creator_score, created_at, expires_at,
  performance_final_dopa_percent, performance_base_dopa_percent, performance_accuracy,
  performance_max_combo, performance_median_reaction_ms
FROM challenges;

-- challenge_attempts_newはまだ存在するchallenges_new（新テーブル）だけを参照する。
-- この時点では旧challenges・旧challenge_attemptsのどちらもまだDROPしていない。
CREATE TABLE challenge_attempts_new (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges_new (id),
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  icon_kind TEXT NOT NULL CHECK (icon_kind IN ('preset', 'remoteCustom')),
  icon_value TEXT NOT NULL,
  equipped_title TEXT,
  score REAL NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('win', 'lose', 'draw')),
  attempt_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  performance_final_dopa_percent REAL,
  performance_base_dopa_percent REAL,
  performance_accuracy REAL,
  performance_max_combo INTEGER,
  performance_median_reaction_ms REAL,
  decided_by TEXT
);

INSERT INTO challenge_attempts_new
  (id, challenge_id, player_id, nickname, icon_kind, icon_value, equipped_title, score, result, attempt_number, created_at,
   performance_final_dopa_percent, performance_base_dopa_percent, performance_accuracy,
   performance_max_combo, performance_median_reaction_ms, decided_by)
SELECT
  id, challenge_id, player_id, nickname, icon_kind, icon_value, equipped_title, score, result, attempt_number, created_at,
  performance_final_dopa_percent, performance_base_dopa_percent, performance_accuracy,
  performance_max_combo, performance_median_reaction_ms, decided_by
FROM challenge_attempts;

-- 旧challenge_attempts（旧challengesへのFKを持つ唯一のテーブル）を先にDROPする。
-- これでもう何も旧challengesを参照していないため、安全にDROPできる。
DROP TABLE challenge_attempts;
DROP TABLE challenges;

-- RENAME時にSQLiteがchallenge_attempts_newのREFERENCES challenges_newを
-- 自動的にREFERENCES challengesへ書き換える。
ALTER TABLE challenges_new RENAME TO challenges;
ALTER TABLE challenge_attempts_new RENAME TO challenge_attempts;

CREATE INDEX IF NOT EXISTS idx_challenges_creator_player_id ON challenges (creator_player_id);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges (created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_id ON challenge_attempts (challenge_id, created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_player ON challenge_attempts (challenge_id, player_id, created_at);
