import type { BattleFormat } from './types'
import type { PrivateRoomState } from './privateRoomEngine'
import type { EndlessDifficulty } from '../types'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PrivateRoom Durable Object
 * （ロビー）のWebSocketメッセージschema。battle/types.tsのBattleClientMessage/
 * BattleServerMessageと同じ方針（versionフィールド、isXxxMessageでの最小限の形チェック）。
 *
 * 実際の対戦（NORMAL/ENDLESS）自体はこのロビーWebSocket上では一切やり取りしない——
 * ホストがstart_matchを送るとサーバー側が別のBattleRoom DOを新規生成し、選ばれた2人は
 * 既存のbattle/battleClient.ts・BattleMatchScreen.tsxがそのまま使う、既存の
 * /api/battles/room/:matchId/ws経由で接続する（ロビーWebSocketとは完全に別の接続）。
 * ロビーWebSocketは「誰が今ルームにいるか・誰が今対戦中か・room-scoped戦績」という
 * ロビー状態の同期だけを担当する。
 */
export const PRIVATE_ROOM_PROTOCOL_VERSION = 1

interface BaseMessage {
  v: typeof PRIVATE_ROOM_PROTOCOL_VERSION
}

export type PrivateRoomClientMessage =
  | (BaseMessage & {
      type: 'start_match'
      memberAId: string
      memberBId: string
      battleType: BattleFormat
      endlessDifficulty: EndlessDifficulty | null
    })
  | (BaseMessage & { type: 'close_room' })

export type PrivateRoomServerMessage =
  | (BaseMessage & { type: 'room_state'; state: PrivateRoomState })
  | (BaseMessage & { type: 'room_closed' })
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
