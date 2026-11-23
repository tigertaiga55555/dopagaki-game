-- 次フェーズ（ゲーム機能クローズラウンド、item 75-77）: 「友達と対戦」ルームからの
-- フレンド招待を、プレゼンスのライブpush（presenceHub DOのsend_room_invite）だけに
-- 頼らず、サーバー側で永続化する。オフライン中の相手に送った招待が、相手が次に
-- FRIENDS画面を開く/アプリへ戻るタイミングで確実に拾える必要があるため——ライブpushは
-- 「今すぐ気づいてもらう」ための最適化に過ぎず、この行こそが唯一の正本（source of truth）。
--
-- (room_code, to_player_id)を複合PRIMARY KEYにすることで、同じ招待の二重送信は
-- 自然にINSERT OR IGNOREでno-opになる（「同じ招待を二重送信できない」制約をDB層でも保証）。
-- 招待を受けた側が実際にそのルームのメンバーになった瞬間（addMember）、またはルームが
-- 閉じた/期限切れになった瞬間に、対応する行を削除する（永遠に残り続けない）。
CREATE TABLE private_room_invites (
  room_code TEXT NOT NULL,
  to_player_id TEXT NOT NULL,
  from_player_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room_code, to_player_id)
);

CREATE INDEX idx_private_room_invites_to_player ON private_room_invites(to_player_id);
CREATE INDEX idx_private_room_invites_room_code ON private_room_invites(room_code);
