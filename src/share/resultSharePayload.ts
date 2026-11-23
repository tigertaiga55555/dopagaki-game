import type { EndlessDifficulty } from '../types'

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 61-66）: X結果シェアのURLペイロード。
 *
 * 設計上の要点（最終報告書にも記載）: このpayloadは「表示用データ」と「報酬の重複防止キー
 * （resultId）」を1つに統合している——別々に管理すると、サーバー側の永続化なしに
 * 「このURLを開いた人に何を見せるか」を再現できなくなるため（アカウント・DBがまだ無い
 * 今回のラウンドでは、URL自体に表示データを埋め込む以外に選択肢がない）。
 * `nonce`は同じスコア・同じ難易度の2回の別プレイを区別するためだけに存在する——
 * 「1結果につき1回まで」の"結果"とは「スコアの値」ではなく「個々のプレイそのもの」を
 * 指す、というユーザー意図の解釈に基づく（同じ100%を2回出した場合、2回ともシェア可能・
 * 報酬対象にすべきで、2回目以降を機械的にブロックすべきではない）。
 * エンコードした文字列そのものをresultId（share/shareRewardRepository.tsのキー）として
 * 使う——同じURLを何度シェアしても同じresultIdになり「それ以上は付与しない」を自然に
 * 満たし、別プレイ（nonceが違う）は常に別resultIdになり独立して報酬対象になる。
 */
export type ResultSharePayload =
  | { v: 1; mode: 'rush'; percent: number; nonce: string }
  | { v: 1; mode: 'endless'; difficulty: EndlessDifficulty; streak: number; nonce: string }

/** 次フェーズ: Date.now()依存を排除し、テストで決定的に検証できるようにnonceは引数で受け取る。 */
export function buildRushSharePayload(percent: number, nonce: string): ResultSharePayload {
  return { v: 1, mode: 'rush', percent, nonce }
}

export function buildEndlessSharePayload(difficulty: EndlessDifficulty, streak: number, nonce: string): ResultSharePayload {
  return { v: 1, mode: 'endless', difficulty, streak, nonce }
}

/**
 * 実際に使うnonce生成（crypto.randomUUIDが無い環境向けのフォールバックも、
 * utils/profileStorage.tsのrandomPlayerId()と同じ方針で用意する）。
 */
export function createShareNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const DIFFICULTY_CODES: Record<EndlessDifficulty, string> = { beginner: 'b', intermediate: 'i', advanced: 'a' }
const DIFFICULTY_BY_CODE: Record<string, EndlessDifficulty> = { b: 'beginner', i: 'intermediate', a: 'advanced' }

function toRaw(payload: ResultSharePayload): string {
  if (payload.mode === 'rush') return `1.r.${payload.percent}.${payload.nonce}`
  return `1.e.${DIFFICULTY_CODES[payload.difficulty]}.${payload.streak}.${payload.nonce}`
}

function fromRaw(raw: string): ResultSharePayload | null {
  const parts = raw.split('.')
  if (parts[0] !== '1') return null
  if (parts[1] === 'r' && parts.length === 4) {
    const percent = Number(parts[2])
    if (!Number.isFinite(percent)) return null
    return { v: 1, mode: 'rush', percent, nonce: parts[3] }
  }
  if (parts[1] === 'e' && parts.length === 5) {
    const difficulty = DIFFICULTY_BY_CODE[parts[2]]
    if (!difficulty) return null
    const streak = Number(parts[3])
    if (!Number.isFinite(streak)) return null
    return { v: 1, mode: 'endless', difficulty, streak, nonce: parts[4] }
  }
  return null
}

/** Base64URL（パディング無し）。battle/roomCode.tsのような人が打つコードではないため大文字小文字は気にしない。 */
function toBase64Url(raw: string): string {
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string | null {
  try {
    const restored = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padLength = (4 - (restored.length % 4)) % 4
    return atob(restored + '='.repeat(padLength))
  } catch {
    return null
  }
}

/** 共有URLの:id部分（resultIdそのもの）を組み立てる。 */
export function encodeResultSharePayload(payload: ResultSharePayload): string {
  return toBase64Url(toRaw(payload))
}

/** 壊れた/改ざんされたidは安全にnullを返す（landing画面側は「表示できません」にフォールバックする）。 */
export function decodeResultSharePayload(resultId: string): ResultSharePayload | null {
  const raw = fromBase64Url(resultId)
  if (raw === null) return null
  return fromRaw(raw)
}
