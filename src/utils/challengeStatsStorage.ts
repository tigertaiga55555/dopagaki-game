/**
 * Ver.6 Phase 10（実績拡張ラウンド）: Challengeの「挑戦者としての」累計成績のローカル記録。
 *
 * 作成者視点の集計（作成済みChallenge一覧の防衛数・指名手配判定）はサーバー（D1）の
 * challenge_attemptsを都度集計して求める（src/worker/challengeRepository.tsの
 * getAggregatesByChallengeIds参照、新規migrationは不要）ため、ここには持たない。
 *
 * 一方、「挑戦者として何回参加し、何回勝ったか」はChallengeごとに分散しており、
 * 全Challenge横断でサーバーから安価に集計する手段が無い（challenge_attemptsは
 * challenge_id単位でしかインデックスされていない）ため、ChallengeResultScreen.tsxが
 * 自分自身の挑戦結果を受け取った直後（＝Result画面到達時）にその場でローカルへ加算する
 * （utils/battleStatsStorage.tsのrecordWorldBattleOutcomeと同じlocal-first方針）。
 * 通常Challenge・ENDLESS Challenge両方をここで合算する（item 27のユーザー指示どおり）。
 */
const KEY = 'dopagaki:challengeChallengerStatsV1'

interface StoredChallengeStats {
  participatedCount: number
  winCount: number
}

function read(): StoredChallengeStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { participatedCount: 0, winCount: 0 }
    const parsed = JSON.parse(raw)
    return {
      participatedCount: typeof parsed.participatedCount === 'number' ? parsed.participatedCount : 0,
      winCount: typeof parsed.winCount === 'number' ? parsed.winCount : 0,
    }
  } catch {
    return { participatedCount: 0, winCount: 0 }
  }
}

function write(next: StoredChallengeStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 保存に失敗しても挑戦自体は既に成立しているため、ここでは何もしない。
  }
}

export function getChallengeStats(): StoredChallengeStats {
  return read()
}

/** 挑戦者として挑戦（通常Challenge・ENDLESS Challenge問わず）の結果を受け取った直後に呼ぶ。 */
export function recordChallengeAttemptResult(result: 'win' | 'lose' | 'draw'): StoredChallengeStats {
  const current = read()
  const next: StoredChallengeStats = {
    ...current,
    participatedCount: current.participatedCount + 1,
    winCount: current.winCount + (result === 'win' ? 1 : 0),
  }
  write(next)
  return next
}
