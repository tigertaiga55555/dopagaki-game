/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: 世界対戦の「自分の累計勝利数・最大連勝」を
 * ローカルへ反映する。既存のProfile/Achievement/PlayerStats（utils/playerStatsRepository.ts）
 * と同じ「local-first」方針——正式な戦績そのものはサーバー（D1のplayer_battle_stats、
 * src/worker/battleRepository.ts）が真実のソースとして保持し、ここで更新するのは
 * あくまで「このブラウザでの自分の記録を即座に見るための」ローカルミラーに過ぎない。
 *
 * 架空ランキング・偽カウントを防ぐため、recordWorldBattleOutcomeはクライアントの
 * 自己判断では一切呼ばない——必ずBattleRoom（サーバー）が確定して送ってきた
 * battle_finishメッセージ（世界対戦のみ）を受け取った直後にだけ呼ぶ。フレンド対戦の
 * 結果では絶対に呼ばない（公式戦績へ一切反映しない、というユーザー指示）。
 */
const KEY = 'dopagaki:worldBattleStatsV1'

interface StoredBattleStats {
  wins: number
  currentStreak: number
  maxStreak: number
}

function read(): StoredBattleStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { wins: 0, currentStreak: 0, maxStreak: 0 }
    const parsed = JSON.parse(raw)
    return {
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      maxStreak: typeof parsed.maxStreak === 'number' ? parsed.maxStreak : 0,
    }
  } catch {
    return { wins: 0, currentStreak: 0, maxStreak: 0 }
  }
}

export function getWorldBattleStats(): StoredBattleStats {
  return read()
}

/** item 26: 勝利→wins+1・currentStreak+1（必要ならmaxStreak更新）。敗北→currentStreak=0。DRAW→winsもstreakも変化しない。 */
export function recordWorldBattleOutcome(outcome: 'win' | 'lose' | 'draw'): StoredBattleStats {
  const current = read()
  const next: StoredBattleStats =
    outcome === 'win'
      ? { wins: current.wins + 1, currentStreak: current.currentStreak + 1, maxStreak: Math.max(current.maxStreak, current.currentStreak + 1) }
      : outcome === 'lose'
        ? { ...current, currentStreak: 0 }
        : current
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 保存に失敗しても対戦自体は既に成立しているため、ここでは何もしない。
  }
  return next
}
