-- 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27）: FRIENDS機能の最小限のサーバー側基盤。
-- ログイン・パスワードは一切導入しない——既存の匿名player_id（getOrCreatePlayerId、
-- utils/profileStorage.ts）をそのままキーに使う、という既存方針をそのまま延長する。
--
-- friend_codes: 人に共有できる短いコード（battle/roomCode.tsと同じ生成方式）から
-- player_idを引けるようにするテーブル。1プレイヤー1コード（再発行はしない——
-- ルームコードと異なり恒久的な識別子として使うため、再発行機能は今回のラウンドでは
-- 実装しない。将来必要になれば別エンドポイントで追加できる）。
CREATE TABLE friend_codes (
  player_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- friend_requests: 申請→承認/拒否のライフサイクル。1組のプレイヤー間で複数回
-- 申請し直せるようにするため（例: 一度拒否された後、再度申請できる）、
-- (from_player_id, to_player_id)にUNIQUE制約は付けない——重複中の申請チェックは
-- アプリ側（friendsRepository.ts）がstatus='pending'の既存行を見て行う。
CREATE TABLE friend_requests (
  id TEXT PRIMARY KEY,
  from_player_id TEXT NOT NULL,
  to_player_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at INTEGER NOT NULL,
  responded_at INTEGER
);

CREATE INDEX idx_friend_requests_to ON friend_requests(to_player_id, status);
CREATE INDEX idx_friend_requests_from ON friend_requests(from_player_id, status);

-- friendships: 確定した友達関係。常にplayer_a_id < player_b_id（文字列比較）の順で
-- 1行だけ保存する正準形にし、「A→B」「B→A」の2行を作らない（重複判定・一覧取得の
-- どちらも単純になる）。
--
-- 将来のブロックリスト拡張性（coordinatorからの明示指示）: 将来`friend_blocks
-- (blocker_id, blocked_id)`のような独立テーブルを追加するだけで実現できる——
-- friendshipsのスキーマ自体を変更する必要がない設計にしてある。
CREATE TABLE friendships (
  player_a_id TEXT NOT NULL,
  player_b_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_a_id, player_b_id)
);

CREATE INDEX idx_friendships_b ON friendships(player_b_id);

-- player_public_profiles: フレンド一覧・フレンドの公開プロフィール画面に必要な
-- 「他人から見える最小限の情報」のサーバー側スナップショット。既存のChallenge作成時に
-- challengesテーブルへcreatorNickname/creatorIcon/creatorEquippedTitleを書き込んでいる
-- 既存パターン（migrations/0001）をそのまま一般化したもの——今回新しい概念を
-- 持ち込んでいるわけではない。
--
-- 誠実な既知のギャップ（最終報告書にも記載）: このテーブルはクライアントが自発的に
-- アップロードした時点のスナップショットであり、常にリアルタイムではない
-- （utils/publicProfileSync.ts参照）。bestDopaPercent等の統計は「本人が最後にアプリを
-- 開いた時点」のものであり、ライブ更新ではない。
CREATE TABLE player_public_profiles (
  player_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  avatar_json TEXT NOT NULL,
  equipped_title_id TEXT,
  has_dopa_pass INTEGER NOT NULL DEFAULT 0,
  best_dopa_percent INTEGER NOT NULL DEFAULT 0,
  endless_beginner_best INTEGER NOT NULL DEFAULT 0,
  endless_intermediate_best INTEGER NOT NULL DEFAULT 0,
  endless_advanced_best INTEGER NOT NULL DEFAULT 0,
  world_battle_wins INTEGER NOT NULL DEFAULT 0,
  achievement_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
