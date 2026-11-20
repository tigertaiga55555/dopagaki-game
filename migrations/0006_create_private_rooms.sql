-- 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: DOPA PASS所有者につき
-- 同時に有効なPRIVATE ROOMを1つまでに制限する、サーバー権威の唯一の仕組み。
-- host_player_idがPRIMARY KEYのため、同じホストが2つ目の行を挿入することはD1側で
-- 構造的に不可能（アプリ側のロジックではなく、スキーマ自体が保証する）。
-- ルーム本体の実際のロビー状態（メンバー・進行中マッチ・room-scoped戦績）はこのテーブルには
-- 一切保持しない——それはPrivateRoom Durable Object（idFromName(room_code)）側の責務であり、
-- このテーブルは「どのホストが今どのroom_codeを持っているか」という1対1の対応だけを
-- 権威的に管理する。

CREATE TABLE private_rooms (
  host_player_id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
