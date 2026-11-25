-- 次フェーズ（item 157-159、挑戦状受信画面のプロフィール表示を通常プロフィールと統一）
-- challenges.creator_equipped_title（既存）と同じ「作成時点のスナップショット」方式で、
-- サブ称号2枠（creator_sub_title_1/2）とDOPA PASS所有状態（creator_has_pass）を追加する。
--
-- CHECK制約を追加・変更しない単純なADD COLUMNのため、0005のようなテーブル再作成は不要
-- （SQLiteはCHECKを広げる場合だけテーブル再作成が必要で、新しい列をNULL許容/デフォルト値
-- 付きで追加するだけなら標準のALTER TABLE ADD COLUMNで足りる）。
--
-- 既存行（このmigration以前に作成されたChallenge）には、サブ称号・PASS所有の実際の値を
-- 推測で埋めることは絶対にしない——creator_sub_title_1/2はNULL（未設定）、
-- creator_has_passは0（false）のデフォルトのまま残す（後方互換。worker/challengeRepository.ts
-- 側でcreator_has_passが無い既存行もfalseとして正しく読める）。

ALTER TABLE challenges ADD COLUMN creator_sub_title_1 TEXT;
ALTER TABLE challenges ADD COLUMN creator_sub_title_2 TEXT;
ALTER TABLE challenges ADD COLUMN creator_has_pass INTEGER NOT NULL DEFAULT 0;
