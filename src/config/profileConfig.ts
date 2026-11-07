import type { PresetIconId } from '../types'

/**
 * Ver.6 Phase 5: プロフィールのプリセットアイコン。ユーザー画像アップロードはまだ
 * 実装せず、外部画像素材も使わない（既存emoji表現のみ）。ドパガキらしい、
 * シンプルで見分けやすい図象だけを選んだ。
 */
export const PRESET_ICONS: PresetIconId[] = ['bolt', 'flame', 'skull', 'eye', 'swirl', 'star', 'crown', 'gem']

export const PRESET_ICON_EMOJI: Record<PresetIconId, string> = {
  bolt: '⚡',
  flame: '🔥',
  skull: '💀',
  eye: '👁️',
  swirl: '🌀',
  star: '⭐',
  crown: '👑',
  gem: '💎',
}

/** ニックネームの最大文字数。一般的なゲームプロフィールとして扱いやすい範囲（不自然に長すぎない）。 */
export const NICKNAME_MAX_LENGTH = 14

export const DEFAULT_ICON_ID: PresetIconId = 'bolt'

/** 初回プロフィール作成時だけ使う、プレイヤーごとに一定のデフォルトニックネーム。 */
export function buildDefaultNickname(playerId: string): string {
  let hash = 0
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) % 10000
  }
  const suffix = String(Math.abs(hash)).padStart(4, '0')
  return `プレイヤー${suffix}`
}
