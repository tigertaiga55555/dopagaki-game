import { buildDefaultNickname, DEFAULT_ICON_ID, NICKNAME_MAX_LENGTH, PRESET_ICONS } from '../config/profileConfig'
import { isTitleUnlocked } from './achievementStorage'
import type { AvatarRef, PlayerId, PlayerProfile, PresetIconId, TitleId } from '../types'

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
  return typeof value === 'string' && (PRESET_ICONS as string[]).includes(value)
}

const DEFAULT_AVATAR: AvatarRef = { kind: 'preset', iconId: DEFAULT_ICON_ID }

/**
 * Ver.6 Phase 5.1: 保存されていた値（新形式のavatar、または旧形式のフラットなiconId、
 * またはどちらも無い/壊れている）から、必ず有効なAvatarRefを1つ組み立てる。
 * 既存ユーザーが持っていた旧iconIdは{kind:'preset', iconId}へそのまま透過的に変換する
 * （Phase 5.1導入前のユーザーのアイコン選択を失わない）。
 */
function resolveAvatar(stored: { avatar?: unknown; iconId?: unknown }): AvatarRef {
  const avatar = stored.avatar as Partial<AvatarRef> | undefined
  if (avatar && avatar.kind === 'preset' && isValidIconId(avatar.iconId)) {
    return { kind: 'preset', iconId: avatar.iconId }
  }
  if (avatar && avatar.kind === 'remoteCustom' && typeof avatar.url === 'string' && avatar.url.length > 0) {
    return { kind: 'remoteCustom', url: avatar.url }
  }
  // 旧形式（Ver.6 Phase 5時点のフラットなiconIdフィールド）からの移行。
  if (isValidIconId(stored.iconId)) {
    return { kind: 'preset', iconId: stored.iconId }
  }
  return DEFAULT_AVATAR
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 72-74）: サブ称号枠の総数（固定2枠＝
 * sub1/sub2）。メイン1枠と合わせて「PASS所有者=3枠・無料ユーザー=メイン1枠のみ」。
 */
export const SUB_TITLE_SLOT_COUNT = 2

function createDefaultProfile(playerId: PlayerId): PlayerProfile {
  return {
    playerId,
    nickname: buildDefaultNickname(playerId),
    avatar: DEFAULT_AVATAR,
    equippedTitleId: null,
    subTitleIds: [null, null],
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

/** 保存形式が将来変わっても読み込めるよう、型を厳密なPlayerProfileに固定しない（旧iconIdフィールドも許容する）。 */
type StoredProfileShape = Partial<Omit<PlayerProfile, 'avatar'>> & { avatar?: unknown; iconId?: unknown }

function readStoredProfile(): StoredProfileShape | null {
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

  const subTitleIds = readStoredSubTitleIds(stored)

  const merged: PlayerProfile = {
    playerId,
    nickname: typeof stored.nickname === 'string' && stored.nickname.length > 0 ? stored.nickname : buildDefaultNickname(playerId),
    avatar: resolveAvatar(stored),
    equippedTitleId: typeof stored.equippedTitleId === 'string' ? stored.equippedTitleId : null,
    subTitleIds,
    createdAt: typeof stored.createdAt === 'number' ? stored.createdAt : Date.now(),
  }
  return merged
}

/**
 * 次フェーズ（item 72-74）: 保存形式の読み込み互換性。
 * - 新形式（subTitleIds: [TitleId|null, TitleId|null]）はそのまま検証して使う。
 * - 旧形式（favoriteTitleIds: TitleId[]、最大3個のお気に入りリスト）しか無い既存ユーザーの
 *   データは、先頭から最大SUB_TITLE_SLOT_COUNT個をsub1/sub2へ素直に引き継ぐ——
 *   「Profileに複数Titleを見せる」という目的は同じ機能の移行であり、無料ユーザーの
 *   旧データはどのみちequipTitleToSlot側のPASSガードで表示されなくなるだけなので、
 *   移行時に特別な変換処理は不要（単に読み替えるだけで安全）。
 */
function readStoredSubTitleIds(stored: StoredProfileShape): [TitleId | null, TitleId | null] {
  const storedSub = (stored as { subTitleIds?: unknown }).subTitleIds
  if (Array.isArray(storedSub)) {
    const a = typeof storedSub[0] === 'string' ? (storedSub[0] as TitleId) : null
    const b = typeof storedSub[1] === 'string' ? (storedSub[1] as TitleId) : null
    return [a, b]
  }
  const legacyFavorites = (stored as { favoriteTitleIds?: unknown }).favoriteTitleIds
  if (Array.isArray(legacyFavorites)) {
    const ids = legacyFavorites.filter((id): id is TitleId => typeof id === 'string')
    return [ids[0] ?? null, ids[1] ?? null]
  }
  return [null, null]
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

/**
 * プリセットアイコンを選択する。将来の自分の写真設定（remoteCustom）はこの関数とは
 * 別のAPIとして追加する想定（サーバーProfile基盤＋画像ストレージ実装時）。
 */
export function updateIcon(iconId: PresetIconId): PlayerProfile {
  const profile = getProfile()
  const next: PlayerProfile = { ...profile, avatar: { kind: 'preset', iconId } }
  saveProfile(next)
  return next
}

/**
 * 称号を装備する。未解除のTitleは装備できない（falseを返し、プロフィールは変更しない）。
 * titleIdにnullを渡すと未装備状態に戻せる（常に許可）。
 *
 * 次フェーズ（DOPA PASS基盤ラウンド）: PASS限定Title（config/passTitles.ts、68個の通常Title
 * とは別コレクション）も装備できるようにするため、isPassTitleOwnedを呼び出し元から注入する
 * （profileStorage.ts自体はpayment/配下への依存を持たない——payment/passTitleGrants.tsを
 * 直接importせず、呼び出し側のUIがそこから得た判定関数を渡すだけの設計）。
 */
export function equipTitle(
  titleId: TitleId | null,
  isPassTitleOwned: (titleId: TitleId) => boolean = () => false,
): { profile: PlayerProfile; ok: boolean } {
  const profile = getProfile()
  if (titleId !== null && !isTitleUnlocked(titleId) && !isPassTitleOwned(titleId)) {
    return { profile, ok: false }
  }
  // 次フェーズ（item 72-74）: equipTitleToSlotと同じ「同じTitleを複数枠に重複させない」
  // 整合性を、この従来からの単独equip経路（ProfileScreen.tsxのPASS限定Title即時装備
  // ボタンが今も使う）にも適用する——サブ枠に既にあるTitleをメインへも装備した場合、
  // サブ枠側の重複表示を自動的に解消する。
  const subTitleIds: [TitleId | null, TitleId | null] =
    titleId === null ? profile.subTitleIds : (profile.subTitleIds.map((id) => (id === titleId ? null : id)) as [TitleId | null, TitleId | null])
  const next: PlayerProfile = { ...profile, equippedTitleId: titleId, subTitleIds }
  saveProfile(next)
  return { profile: next, ok: true }
}

export type TitleSlot = 'main' | 'sub1' | 'sub2'

/** 次フェーズ（item 72-74）: 指定した枠に現在入っているTitleId（未装備ならnull）。 */
export function getTitleInSlot(profile: PlayerProfile, slot: TitleSlot): TitleId | null {
  if (slot === 'main') return profile.equippedTitleId
  return profile.subTitleIds[slot === 'sub1' ? 0 : 1]
}

/** 次フェーズ（item 72-74）: このTitleIdが現在どの枠に入っているか（どこにも無ければnull）。 */
export function findSlotForTitle(profile: PlayerProfile, titleId: TitleId): TitleSlot | null {
  if (profile.equippedTitleId === titleId) return 'main'
  if (profile.subTitleIds[0] === titleId) return 'sub1'
  if (profile.subTitleIds[1] === titleId) return 'sub2'
  return null
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 72-74）: 指定した枠（main/sub1/sub2）へ
 * Titleを装備する。sub1/sub2はPASS所有者だけが使える——hasPass=falseでsub枠を指定した
 * 場合は常にok:falseで何も変更しない（UIがそもそもsub枠のボタン自体を無料ユーザーへ
 * 見せない設計だが、呼び出し側のガード漏れに対しても二重に安全側へ倒す）。
 * 未解除のTitleを装備できない制約はequipTitleと完全に同じ。同じTitleを複数枠に重複させない
 * ——指定した枠以外に既にあれば、そこは自動的に空になる（スワップ的な挙動）。
 */
export function equipTitleToSlot(
  titleId: TitleId,
  slot: TitleSlot,
  hasPass: boolean,
  isPassTitleOwned: (titleId: TitleId) => boolean = () => false,
): { profile: PlayerProfile; ok: boolean } {
  const profile = getProfile()
  if (slot !== 'main' && !hasPass) return { profile, ok: false }
  if (!isTitleUnlocked(titleId) && !isPassTitleOwned(titleId)) return { profile, ok: false }

  let equippedTitleId = profile.equippedTitleId === titleId ? null : profile.equippedTitleId
  const subTitleIds: [TitleId | null, TitleId | null] = [
    profile.subTitleIds[0] === titleId ? null : profile.subTitleIds[0],
    profile.subTitleIds[1] === titleId ? null : profile.subTitleIds[1],
  ]

  if (slot === 'main') equippedTitleId = titleId
  else if (slot === 'sub1') subTitleIds[0] = titleId
  else subTitleIds[1] = titleId

  const next: PlayerProfile = { ...profile, equippedTitleId, subTitleIds }
  saveProfile(next)
  return { profile: next, ok: true }
}

/** 次フェーズ（item 72-74）: 指定した枠を未装備に戻す（常に許可——装備の取り消しに制約はない）。 */
export function unequipTitleFromSlot(slot: TitleSlot): PlayerProfile {
  const profile = getProfile()
  let next: PlayerProfile
  if (slot === 'main') {
    next = { ...profile, equippedTitleId: null }
  } else {
    const subTitleIds: [TitleId | null, TitleId | null] = [...profile.subTitleIds]
    subTitleIds[slot === 'sub1' ? 0 : 1] = null
    next = { ...profile, subTitleIds }
  }
  saveProfile(next)
  return next
}
