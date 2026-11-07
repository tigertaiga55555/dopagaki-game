import { buildDefaultNickname, DEFAULT_ICON_ID, NICKNAME_MAX_LENGTH } from '../config/profileConfig'
import { isTitleUnlocked } from './achievementStorage'
import type { PlayerId, PlayerProfile, PresetIconId, TitleId } from '../types'

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: ログイン不要の匿名プレイヤーIDと
 * ローカルプロフィール。
 *
 * player_idはプロフィールとは別のキーで独立して保存する（PlayerProfile内にも
 * playerIdフィールドを持たせてはいるが、真の保存先は常にこの専用キー一本）。
 * 将来のDOPA PASS購入→Google/Email認証導入時、このIDをそのままアカウントへ
 * 紐付ける鍵として使えるよう、storageの実装（localStorageかどうか）へ他のコードが
 * 密結合しないよう、必ずgetOrCreatePlayerId()/getProfile()等の関数経由でのみ
 * アクセスさせる。
 */
const PLAYER_ID_KEY = 'dopagaki:playerIdV1'
const PROFILE_KEY = 'dopagaki:profileV1'

function randomPlayerId(): PlayerId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUIDが無い環境向けの衝突しにくいフォールバック（UUID互換ではないが一意性は十分）。
  return `pid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 初回アクセス時に匿名player_idを生成してlocalStorageへ保存する。以後は同じ値を返し続ける。 */
export function getOrCreatePlayerId(): PlayerId {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY)
    if (existing) return existing
    const created = randomPlayerId()
    localStorage.setItem(PLAYER_ID_KEY, created)
    return created
  } catch {
    // localStorageが使えない環境（プライベートモード等）でもゲーム自体は続行できるよう、
    // プロセス内だけで有効な一時IDを返す（保存はできないため次回ロードでは変わる）。
    return randomPlayerId()
  }
}

function isValidIconId(value: unknown): value is PresetIconId {
  return typeof value === 'string' && ['bolt', 'flame', 'skull', 'eye', 'swirl', 'star', 'crown', 'gem'].includes(value)
}

function createDefaultProfile(playerId: PlayerId): PlayerProfile {
  return {
    playerId,
    nickname: buildDefaultNickname(playerId),
    iconId: DEFAULT_ICON_ID,
    equippedTitleId: null,
    createdAt: Date.now(),
  }
}

function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // 保存に失敗しても画面は引き続き動作させる（次回読み込み時に再度デフォルトから作られるだけ）。
  }
}

function readStoredProfile(): Partial<PlayerProfile> | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

/**
 * プロフィールを取得する。存在しなければ（初回アクセス時）、player_idを確保した上で
 * デフォルトプロフィールを作成・保存してから返す（＝呼び出し側は常にtry/catch不要で
 * 完全なPlayerProfileを受け取れる）。既存の壊れた/部分的なデータが見つかった場合も、
 * 欠けているフィールドだけデフォルト値で補って返す（既存のplayer_id・nickname等は失わない）。
 */
export function getProfile(): PlayerProfile {
  const playerId = getOrCreatePlayerId()
  const stored = readStoredProfile()
  if (!stored) {
    const fresh = createDefaultProfile(playerId)
    saveProfile(fresh)
    return fresh
  }

  const merged: PlayerProfile = {
    playerId,
    nickname: typeof stored.nickname === 'string' && stored.nickname.length > 0 ? stored.nickname : buildDefaultNickname(playerId),
    iconId: isValidIconId(stored.iconId) ? stored.iconId : DEFAULT_ICON_ID,
    equippedTitleId: typeof stored.equippedTitleId === 'string' ? stored.equippedTitleId : null,
    createdAt: typeof stored.createdAt === 'number' ? stored.createdAt : Date.now(),
  }
  return merged
}

/** ニックネームを検証・整形してから保存する（前後空白を除去し、最大文字数でclamp）。空になった場合はデフォルトへ戻す。 */
export function updateNickname(rawNickname: string): PlayerProfile {
  const profile = getProfile()
  const trimmed = rawNickname.trim()
  const clamped = Array.from(trimmed).slice(0, NICKNAME_MAX_LENGTH).join('')
  const nextNickname = clamped.length > 0 ? clamped : buildDefaultNickname(profile.playerId)
  const next: PlayerProfile = { ...profile, nickname: nextNickname }
  saveProfile(next)
  return next
}

export function updateIcon(iconId: PresetIconId): PlayerProfile {
  const profile = getProfile()
  const next: PlayerProfile = { ...profile, iconId }
  saveProfile(next)
  return next
}

/**
 * 称号を装備する。未解除のTitleは装備できない（falseを返し、プロフィールは変更しない）。
 * titleIdにnullを渡すと未装備状態に戻せる（常に許可）。
 */
export function equipTitle(titleId: TitleId | null): { profile: PlayerProfile; ok: boolean } {
  const profile = getProfile()
  if (titleId !== null && !isTitleUnlocked(titleId)) {
    return { profile, ok: false }
  }
  const next: PlayerProfile = { ...profile, equippedTitleId: titleId }
  saveProfile(next)
  return { profile: next, ok: true }
}
