-- Ver.6 Phase 5.1（Challengeバックエンド基盤）
-- challenge_attempts: 1つのChallenge（挑戦状）に対する、各挑戦者の1回ぶんの挑戦結果。
-- 同じplayer_idが同じchallenge_idに何度でも挑戦できる想定（ユーザー指示：同一プレイヤーの
-- リトライは無制限）ため、(challenge_id, player_id) の組は一意にしない。
--
-- このテーブルは今回のラウンドではAPIも読み書きコードも実装しない（スキーマだけ用意する）。
-- 「挑戦状を送る→受け取った側がプレイ→WIN/LOSE記録→作成者が挑戦者ごとの履歴を見る」という
-- 機能一式は次ラウンド以降の対象。将来、無料ユーザーは直近10件のみ閲覧可（DOPA PASSで全履歴）
-- という制限をかける予定だが、それは読み取りAPI側のページングで実現し、このテーブル自体には
-- 「古い履歴を消す」ような破壊的な仕組みを持たせない（履歴は常に全件保持する）。
CREATE TABLE IF NOT EXISTS challenge_attempts (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges (id),

  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  icon_kind TEXT NOT NULL CHECK (icon_kind IN ('preset', 'remoteCustom')),
  icon_value TEXT NOT NULL,
  equipped_title TEXT,

  score REAL NOT NULL,
  -- 'win'（作成者のスコアを上回った） | 'lose'（上回れなかった）。
  result TEXT NOT NULL CHECK (result IN ('win', 'lose')),
  -- このplayer_idにとって、このchallenge_idへの何回目の挑戦か（1始まり）。
  attempt_number INTEGER NOT NULL,

  created_at INTEGER NOT NULL
);

-- 作成者が「このChallengeへの挑戦一覧」を見るための検索。
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_id ON challenge_attempts (challenge_id, created_at);
-- 挑戦者が「自分のこのChallengeへの履歴」を見るための検索（直近10件ページングにもそのまま使える）。
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_player ON challenge_attempts (challenge_id, player_id, created_at);
