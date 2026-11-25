import type { PublicProfileSnapshot } from '../friends/types'

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 28）: PresenceHub Durable Object用の
 * WebSocketメッセージ定義。battle/types.tsと同じ方針（versionフィールド、型だけの共有）。
 *
 * 設計判断（最終報告書にも記載）: PresenceHub専用の単一グローバルDurable Object
 * （Matchmakerと同じ、idFromName('global')の単一インスタンス）として新設した。
 * 理由: ①既存のBattleRoom/PrivateRoomはどちらも「1試合/1部屋」単位でスコープされた
 * DOであり、「このプレイヤーは今オンラインか」というプレイヤー単位・グローバルな
 * 概念を持たせるのは責務が合わない。②ポーリングではなくWebSocket Hibernationに
 * した理由は、オンライン/オフライン検出がまさに「接続が張られているか」という
 * WebSocketのライフサイクルそのもので表現できるため（素直で、追加の有効期限管理が
 * 要らない）。③このHubはPRIVATE ROOM招待の配信チャネルにも相乗りする（招待したい
 * 相手が「オンライン」である＝まさにこのHubへの接続を持っている、という定義に
 * 一致するため、新しい配信経路を別途作らずに済む）。
 *
 * 次フェーズ（ゲーム機能クローズラウンド、item 75-77）: 招待の「送信」自体はもう
 * このWebSocketクライアントメッセージ（send_room_invite）経由で行わない——
 * オフライン中の相手に送った招待がライブpushだけに依存すると消えてしまう実バグが
 * あったため、POST /api/rooms/private/:roomCode/invite（D1へ必ず永続化した上で、
 * PresenceHubの内部HTTPエンドポイント経由で「今オンラインなら」追加で即時pushする）
 * へ置き換えた。room_invite_received（サーバー→クライアント、ライブpush自体）は
 * そのまま残す——「今すぐ気づいてもらう」ための配信チャネルとしては引き続き有効。
 */
export const PRESENCE_PROTOCOL_VERSION = 1

interface BaseMessage {
  v: typeof PRESENCE_PROTOCOL_VERSION
}

export type PresenceState = 'online' | 'playing'

export type PresenceClientMessage =
  | (BaseMessage & { type: 'set_state'; state: PresenceState })
  /** フレンド一覧画面が、表示中のフレンドIDぶんだけ購読する。購読は毎回全件を置き換える（累積しない）。 */
  | (BaseMessage & { type: 'subscribe'; playerIds: string[] })

export type PresenceSnapshot = Record<string, 'online' | 'playing' | 'offline'>

export type PresenceServerMessage =
  | (BaseMessage & { type: 'presence_snapshot'; snapshot: PresenceSnapshot })
  /** item 75-77: ライブpush経由の即時通知（永続化の正本はD1のprivate_room_invites）。 */
  | (BaseMessage & { type: 'room_invite_received'; fromProfile: PublicProfileSnapshot; roomCode: string })

export function isPresenceClientMessage(raw: unknown): raw is PresenceClientMessage {
  if (typeof raw !== 'object' || raw === null) return false
  const msg = raw as Partial<PresenceClientMessage>
  if (msg.v !== PRESENCE_PROTOCOL_VERSION) return false
  return typeof (msg as { type?: unknown }).type === 'string'
}
