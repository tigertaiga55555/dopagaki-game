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
/**
 * Ver.6 Phase 10（実績拡張ラウンド）: フレンド対戦は「公式戦績へ一切反映しない」という
 * 既存方針（このファイル冒頭コメント参照）のとおりwins/streak系とは完全に別キーで持つ。
 * Friend Battle実績4個は純粋な累計プレイ回数だけが条件のため、勝敗は一切記録しない。
 */
const FRIEND_PLAY_KEY = 'dopagaki:friendBattlePlayCountV1'

interface StoredBattleStats {
  wins: number
  currentStreak: number
  maxStreak: number
  /** Ver.6 Phase 10: 世界対戦の累計プレイ回数（勝敗問わず）。worldBattleFirstPlay判定に使う。 */
  totalPlays: number
  /** Ver.6 Phase 10: 世界対戦で一度でもDRAWになったことがあるか。worldBattleFirstDraw判定に使う。 */
  hasDrawn: boolean
}

function read(): StoredBattleStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { wins: 0, currentStreak: 0, maxStreak: 0, totalPlays: 0, hasDrawn: false }
    const parsed = JSON.parse(raw)
    return {
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      maxStreak: typeof parsed.maxStreak === 'number' ? parsed.maxStreak : 0,
      totalPlays: typeof parsed.totalPlays === 'number' ? parsed.totalPlays : 0,
      hasDrawn: parsed.hasDrawn === true,
    }
  } catch {
    return { wins: 0, currentStreak: 0, maxStreak: 0, totalPlays: 0, hasDrawn: false }
  }
}

export function getWorldBattleStats(): StoredBattleStats {
  return read()
}

/** item 26: 勝利→wins+1・currentStreak+1（必要ならmaxStreak更新）。敗北→currentStreak=0。DRAW→winsもstreakも変化しない。totalPlaysは結果に関わらず必ず+1する。 */
export function recordWorldBattleOutcome(outcome: 'win' | 'lose' | 'draw'): StoredBattleStats {
  const current = read()
  const advanced: StoredBattleStats =
    outcome === 'win'
      ? { ...current, wins: current.wins + 1, currentStreak: current.currentStreak + 1, maxStreak: Math.max(current.maxStreak, current.currentStreak + 1) }
      : outcome === 'lose'
        ? { ...current, currentStreak: 0 }
        : current
  const next: StoredBattleStats = { ...advanced, totalPlays: current.totalPlays + 1, hasDrawn: current.hasDrawn || outcome === 'draw' }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 保存に失敗しても対戦自体は既に成立しているため、ここでは何もしない。
  }
  return next
}

function readFriendPlayCount(): number {
  try {
    const raw = localStorage.getItem(FRIEND_PLAY_KEY)
    const value = raw ? Number(raw) : 0
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function getFriendBattlePlayCount(): number {
  return readFriendPlayCount()
}

/** フレンド対戦の対局が1回終わるたびに呼ぶ（勝敗は問わない、累計参加回数だけを数える）。 */
export function incrementFriendBattlePlayCount(): number {
  try {
    const next = readFriendPlayCount() + 1
    localStorage.setItem(FRIEND_PLAY_KEY, String(next))
    return next
  } catch {
    return readFriendPlayCount()
  }
}
