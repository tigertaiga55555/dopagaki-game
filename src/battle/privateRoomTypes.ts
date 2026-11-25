import type { BattleFormat } from './types'
import type { PrivateRoomState } from './privateRoomEngine'
import type { EndlessDifficulty } from '../types'

/**
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 43以降）: PrivateRoom Durable Object
 * （ロビー）のWebSocketメッセージschema。battle/types.tsのBattleClientMessage/
 * BattleServerMessageと同じ方針（versionフィールド、isXxxMessageでの最小限の形チェック）。
 *
 * item 43の設計変更: 旧'start_match'（ホストが2人を指名する）は廃止した。今はTABLEへの
 * enter/leave・ルール選択・READYだけをやり取りし、両座席がREADYになった瞬間はサーバー
 * （PrivateRoom DOラッパー）が自動的に対戦を開始する——クライアントから「開始」を
 * 明示的に要求するメッセージは存在しない。
 *
 * 実際の対戦（NORMAL/ENDLESS）自体はこのロビーWebSocket上では一切やり取りしない——
 * 両座席がREADYになるとサーバー側が別のBattleRoom DOを新規生成し、選ばれた2人は
 * 既存のbattle/battleClient.ts・BattleMatchScreen.tsxがそのまま使う、既存の
 * /api/battles/room/:matchId/ws経由で接続する（ロビーWebSocketとは完全に別の接続）。
 */
export const PRIVATE_ROOM_PROTOCOL_VERSION = 1

interface BaseMessage {
  v: typeof PRIVATE_ROOM_PROTOCOL_VERSION
}

export type PrivateRoomClientMessage =
  | (BaseMessage & { type: 'enter_table'; tableId: number })
  | (BaseMessage & { type: 'leave_table' })
  | (BaseMessage & { type: 'set_table_rules'; tableId: number; battleType: BattleFormat; endlessDifficulty: EndlessDifficulty | null })
  | (BaseMessage & { type: 'set_table_ready'; tableId: number; ready: boolean })
  | (BaseMessage & { type: 'close_room' })
  /**
   * item 45/46: フレンド招待の送信（presenceClient.ts経由、PrivateRoom DOを一切経由しない）を
   * 「意味のある活動」としてもlastActivityAtへ反映させたいだけの、状態を一切変えない薄い通知。
   * 送信元が自分自身であることの検証以上の権限チェックは不要（招待の宛先・内容はこのDOの
   * 関心事ではない）。
   */
  | (BaseMessage & { type: 'touch_activity' })
  /**
   * 次フェーズ（item 15、実機/E2Eで発見した耐障害性の改善）: サーバー側のpush配信
   * （broadcastState）が何らかの理由（接続の一時的な不調、Hibernatable WebSocketの
   * 長時間アイドル等）で届かなかった場合に備え、クライアント側から能動的に最新状態を
   * 取り直せるようにする。room_stateのpushだけに依存しない二重の経路を持たせることで、
   * 「対戦が終わったのにロビー表示が古いまま」という状態からの自己復帰を保証する。
   */
  | (BaseMessage & { type: 'request_state' })

export type RoomClosedReason = 'host_closed' | 'expired'

export type PrivateRoomServerMessage =
  | (BaseMessage & { type: 'room_state'; state: PrivateRoomState })
  | (BaseMessage & { type: 'room_closed'; reason: RoomClosedReason })
  | (BaseMessage & { type: 'error'; message: string })

export interface CreatePrivateRoomResponse {
  roomCode: string
}

export type PrivateRoomStatusResponse = { ok: true; closed: boolean; memberCount: number } | { ok: false; reason: 'not_found' | 'closed' }

/** 任意JSONをそのまま信用しない（battle/types.ts isBattleClientMessageと同じ方針）。 */
export function isPrivateRoomClientMessage(raw: unknown): raw is PrivateRoomClientMessage {
  if (typeof raw !== 'object' || raw === null) return false
  const msg = raw as Partial<PrivateRoomClientMessage>
  if (msg.v !== PRIVATE_ROOM_PROTOCOL_VERSION) return false
  if (typeof (msg as { type?: unknown }).type !== 'string') return false
  return true
}
