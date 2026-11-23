-- 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 46-47）: 「今、どのプレイヤーが
-- どのPRIVATE ROOMに参加中か」をサーバー権威で追跡する、player_idキーの最小限の
-- アカウント／セッション基盤。将来の実アカウント移行時も、player_idの意味自体は
-- 変わらないため、このテーブルの設計をそのまま延長できる（既存のPASS entitlementの
-- 境界設計と同じ精神）。
--
-- 1プレイヤーにつき同時に1つのアクティブなPRIVATE ROOMだけを許す（ホストの1部屋制限
-- （private_rooms）と同じ正準化——「今どこにいるか」を1行で確実に表現する）。
-- ルームが閉じる／期限切れになった瞬間、そのルームの全メンバーの行を一括で消す
-- （clearMembershipsForRoom）ことで、存在しないルームへの「戻る」導線が残らないようにする。
CREATE TABLE private_room_memberships (
  player_id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  joined_at INTEGER NOT NULL
);

CREATE INDEX idx_private_room_memberships_room_code ON private_room_memberships(room_code);

-- 次フェーズ（item 44）: ルームが閉じた/期限切れになった瞬間に1行だけ書き込む、
-- 「このルームがいつ・誰によって・何人で・何試合行われたか」の確定済みサマリー。
-- 将来のDOPA PASS「自分が作成したルームの履歴」機能が、host_player_idで検索する
-- 想定のデータ形状（この丸ごとの集計画面自体は今回は作らない——データモデルだけ）。
CREATE TABLE private_room_sessions (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  host_player_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  member_count INTEGER NOT NULL,
  match_count INTEGER NOT NULL
);

CREATE INDEX idx_private_room_sessions_host ON private_room_sessions(host_player_id, ended_at);

-- 次フェーズ（item 44）: 上のセッションに属する、各試合の確定済み詳細（PrivateRoom DOの
-- ctx.storage上にある生存中のmatchHistoryを、ルームが閉じる瞬間にそのままコピーする）。
-- ロビー内の新しい順フィード表示自体はDOのライブ状態（room_state.matchHistory）から
-- 直接描画し、このテーブルは「ルームが消えた後も残る確定記録」専用。
CREATE TABLE private_room_match_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  room_code TEXT NOT NULL,
  table_id INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  player_a_id TEXT NOT NULL,
  player_a_nickname TEXT NOT NULL,
  player_b_id TEXT NOT NULL,
  player_b_nickname TEXT NOT NULL,
  winner TEXT NOT NULL,
  battle_type TEXT NOT NULL,
  endless_difficulty TEXT,
  player_a_final_dopa_percent REAL,
  player_b_final_dopa_percent REAL,
  player_a_streak INTEGER,
  player_b_streak INTEGER
);

CREATE INDEX idx_private_room_match_history_session ON private_room_match_history(session_id);
