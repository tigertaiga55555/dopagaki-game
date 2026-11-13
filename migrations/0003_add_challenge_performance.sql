-- Ver.6 Phase 5.3（Challenge勝敗判定強化）
-- 最終DOPA%が同じでも「通常獲得DOPA%→正答率→最大COMBO→反応速度中央値」の順で
-- タイブレークできるよう、challenges（作成者の基準記録）・challenge_attempts
-- （挑戦者の記録）の両方へperformance列を追加する。
--
-- 既存のchallenges/challenge_attempts行には、このmigration以前にはperformanceという
-- 概念自体が存在しなかったため、追加する列は全てNULL許容にする（0001/0002の既存
-- テーブル定義・既存行は一切変更しない。既存データにないperformance値を推測で
-- 埋めることもしない——古いChallenge/attemptは単にperformanceがNULLのまま残り、
-- Worker側（src/worker/index.ts）がそれを検知して旧ルール（creatorScoreだけの
-- 単純比較）へフォールバックする）。

ALTER TABLE challenges ADD COLUMN performance_final_dopa_percent REAL;
ALTER TABLE challenges ADD COLUMN performance_base_dopa_percent REAL;
ALTER TABLE challenges ADD COLUMN performance_accuracy REAL;
ALTER TABLE challenges ADD COLUMN performance_max_combo INTEGER;
ALTER TABLE challenges ADD COLUMN performance_median_reaction_ms REAL;

ALTER TABLE challenge_attempts ADD COLUMN performance_final_dopa_percent REAL;
ALTER TABLE challenge_attempts ADD COLUMN performance_base_dopa_percent REAL;
ALTER TABLE challenge_attempts ADD COLUMN performance_accuracy REAL;
ALTER TABLE challenge_attempts ADD COLUMN performance_max_combo INTEGER;
ALTER TABLE challenge_attempts ADD COLUMN performance_median_reaction_ms REAL;
-- 勝敗を決めた比較項目。'finalDopaPercent' | 'baseDopaPercent' | 'accuracy' | 'maxCombo' |
-- 'medianCorrectReactionMs' | 'exactTie' | 'legacyScoreOnly'（src/challenge/types.ts参照）。
ALTER TABLE challenge_attempts ADD COLUMN decided_by TEXT;
