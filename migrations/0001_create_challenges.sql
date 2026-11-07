-- Ver.6 Phase 5.1（Challengeバックエンド基盤）
-- challenges: 「挑戦状」1件＝作成者が到達したスコア＋そのときの問題セット＋条件。
-- 今回のラウンドで実装するWorker APIは、このテーブルへのINSERT（作成）とid検索（取得）のみ。
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,

  -- 作成者情報。players テーブルをまだ持たないため、既存のローカルprofileStorage.tsが
  -- 発行するplayerId・nickname・avatar・equippedTitleIdをそのままスナップショットとして
  -- 保存する（将来playersテーブルができても、Challengeの表示に他テーブルのJOINが
  -- 不要なまま読めるようにするための非正規化。挑戦状は「送った時点」の見た目を保つ方が
  -- 自然なため、後から作成者がニックネームを変えてもここは変わらない仕様とする）。
  creator_player_id TEXT NOT NULL,
  creator_nickname TEXT NOT NULL,
  -- AvatarRef（types.ts）の{kind:'preset', iconId} or {kind:'remoteCustom', url}を展開して保存。
  creator_icon_kind TEXT NOT NULL CHECK (creator_icon_kind IN ('preset', 'remoteCustom')),
  creator_icon_value TEXT NOT NULL,
  -- 装備中Title（config/titles.tsのTitleDef.id）。未装備ならNULL。
  creator_equipped_title TEXT,

  -- 'normal' | 'finalTrial' | 'challenge500'（src/challenge/types.ts ChallengeMode）。
  mode TEXT NOT NULL CHECK (mode IN ('normal', 'finalTrial', 'challenge500')),

  -- 出題された問題の並び（ChallengeProblemSet）をJSON文字列として保存する。
  -- クライアントから届いた生JSONをそのまま書き込むことはせず、必ずWorker側の
  -- validation.ts（validateCreateChallengeInput）を通過した値だけがここに入る。
  problem_set TEXT NOT NULL,
  -- プレイ条件（ChallengeConditions）。現時点ではmodeの重複保持のみ。
  conditions TEXT NOT NULL,

  creator_score REAL NOT NULL,
  created_at INTEGER NOT NULL,

  -- 将来の「期限切れ挑戦状」機能用に列だけ先に用意する（今回はロジックを実装しない。
  -- NULLなら無期限として扱う）。
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator_player_id ON challenges (creator_player_id);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges (created_at);
