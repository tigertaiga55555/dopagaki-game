-- Ver.6 Phase 8（ENDLESS Challenge）: challenges.mode へ'endless'を、
-- challenge_attempts.result へ'draw'を追加で許可する（通常Challengeの新しい
-- 「完全同値はDRAW」ルールにも必要）。
--
-- SQLiteはCHECK制約だけを後から緩めるALTER文を持たない（ADD COLUMNしかできない）ため、
-- 標準的な「テーブル再作成」手順でCHECKだけを広げる。既存行は一切変換せず、
-- そのままコピーするだけ（データの推測変換はしない。新しいmode/result値は
-- このmigration以降に作られる新規行だけが持つ）。
-- 他の列・既存データ・既存のperformance_*列は一切変更しない。

PRAGMA foreign_keys = OFF;

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

DROP TABLE challenges;
ALTER TABLE challenges_new RENAME TO challenges;

CREATE INDEX IF NOT EXISTS idx_challenges_creator_player_id ON challenges (creator_player_id);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges (created_at);

CREATE TABLE challenge_attempts_new (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges (id),
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

DROP TABLE challenge_attempts;
ALTER TABLE challenge_attempts_new RENAME TO challenge_attempts;

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_id ON challenge_attempts (challenge_id, created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_player ON challenge_attempts (challenge_id, player_id, created_at);

PRAGMA foreign_keys = ON;
