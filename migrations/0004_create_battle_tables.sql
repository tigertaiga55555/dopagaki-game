-- Ver.6 Phase 6（1対1リアルタイム対戦）: 世界対戦の正式戦績をD1へ保存するテーブル。
-- 既存のchallenges/challenge_attemptsスキーマは一切変更しない（破壊的変更なし）。
-- フレンド対戦の結果はここへ保存しない（公式戦績へ一切反映しない、というユーザー指示）。

CREATE TABLE battle_matches (
  match_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  player1_final_dopa_percent REAL NOT NULL,
  player1_base_dopa_percent REAL NOT NULL,
  player1_accuracy REAL NOT NULL,
  player1_max_combo INTEGER NOT NULL,
  player1_median_reaction_ms INTEGER,
  player2_final_dopa_percent REAL NOT NULL,
  player2_base_dopa_percent REAL NOT NULL,
  player2_accuracy REAL NOT NULL,
  player2_max_combo INTEGER NOT NULL,
  player2_median_reaction_ms INTEGER,
  winner TEXT NOT NULL,
  decided_by TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  finish_reason TEXT NOT NULL
);

CREATE INDEX idx_battle_matches_player1 ON battle_matches(player1_id);
CREATE INDEX idx_battle_matches_player2 ON battle_matches(player2_id);

-- 世界対戦のみの累計戦績。将来のserver rankingへそのまま拡張できる形
-- （playerIdをキーにした単純な集計テーブル）。
CREATE TABLE player_battle_stats (
  player_id TEXT PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
