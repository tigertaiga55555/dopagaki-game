import type { AvatarRef, PresetIconId } from '../types'

/**
 * Ver.6 Phase 5.1（icon拡充）: プロフィールのプリセットアイコン。24種類、5カテゴリ。
 * ユーザー画像アップロードはまだ実装せず、外部画像素材も使わない（既存emoji表現のみ）。
 * ドパガキらしい、シンプルで見分けやすい図象だけを選び、カテゴリごとにまとめることで
 * 一覧として見た時に楽しい構成にした。既存8種（ネオン系）のidは一切変更していない
 * （既存ユーザーのavatar.iconIdを壊さない）。
 */
export interface IconCategoryDef {
  id: string
  label: string
  icons: PresetIconId[]
}

export const ICON_CATEGORIES: IconCategoryDef[] = [
  { id: 'neon', label: 'ネオン系', icons: ['bolt', 'flame', 'skull', 'eye', 'swirl', 'star', 'crown', 'gem'] },
  { id: 'face', label: '顔', icons: ['devil', 'sunglasses', 'mindblown', 'hot', 'ogre'] },
  { id: 'animal', label: '動物', icons: ['cat', 'wolf', 'fox', 'frog'] },
  { id: 'game', label: 'ゲーム', icons: ['joystick', 'target', 'trophy', 'dice'] },
  { id: 'fx', label: 'エフェクト', icons: ['boom', 'rainbow', 'crystalball'] },
]

export const PRESET_ICONS: PresetIconId[] = ICON_CATEGORIES.flatMap((c) => c.icons)

export const PRESET_ICON_EMOJI: Record<PresetIconId, string> = {
  // ネオン系（既存8種）
  bolt: '⚡',
  flame: '🔥',
  skull: '💀',
  eye: '👁️',
  swirl: '🌀',
  star: '⭐',
  crown: '👑',
  gem: '💎',
  // 顔
  devil: '😈',
  sunglasses: '😎',
  mindblown: '🤯',
  hot: '🥵',
  ogre: '👹',
  // 動物
  cat: '🐱',
  wolf: '🐺',
  fox: '🦊',
  frog: '🐸',
  // ゲーム
  joystick: '🕹️',
  target: '🎯',
  trophy: '🏆',
  dice: '🎲',
  // エフェクト
  boom: '💥',
  rainbow: '🌈',
  crystalball: '🔮',
}

/** ニックネームの最大文字数。一般的なゲームプロフィールとして扱いやすい範囲（不自然に長すぎない）。 */
export const NICKNAME_MAX_LENGTH = 14

export const DEFAULT_ICON_ID: PresetIconId = 'bolt'

/**
 * AvatarRefから実際に描画する絵文字を解決する。remoteCustom（将来のサーバー画像）は
 * 今回どこからも生成されないが、型を網羅的に扱うため汎用プレースホルダーを返しておく。
 */
export function resolveAvatarEmoji(avatar: AvatarRef): string {
  if (avatar.kind === 'preset') return PRESET_ICON_EMOJI[avatar.iconId]
  return '🙂'
}

/** 初回プロフィール作成時だけ使う、プレイヤーごとに一定のデフォルトニックネーム。 */
export function buildDefaultNickname(playerId: string): string {
  let hash = 0
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) % 10000
  }
  const suffix = String(Math.abs(hash)).padStart(4, '0')
  return `プレイヤー${suffix}`
}
