import { useEffect, useState } from 'react'
import { NavBar } from '../components/NavBar'
import { resolveAvatarEmoji } from '../config/profileConfig'
import { getActiveRoomForHost } from '../battle/privateRoomClient'
import { getOrCreateFriendCode, listFriends, listIncomingFriendRequests, respondToFriendRequest, sendFriendRequest } from '../friends/friendsClient'
import { sfx } from '../utils/sound'
import type { FriendSummary, IncomingFriendRequest } from '../friends/types'
import type { PresenceSnapshot } from '../presence/presenceTypes'

interface Props {
  onBack: () => void
  onHome: () => void
  playerId: string
  hasPass: boolean
  presenceSnapshot: PresenceSnapshot
  onSubscribePresence: (playerIds: string[]) => void
  onOpenFriendProfile: (playerId: string) => void
  onRequirePass: () => void
  /** 次フェーズ（item 75-77）: 戻り値で成否・理由を返す（トースト表示に使う）。プレゼンス（オンライン状態）はもう一切見ない。 */
  onInviteToExistingRoom: (toPlayerId: string, roomCode: string) => Promise<{ ok: boolean; reason?: string }>
  onCreateRoomAndInvite: (toPlayerId: string) => Promise<{ ok: boolean; reason?: string }>
}

const INVITE_ERROR_REASON_LABEL: Record<string, string> = {
  not_friends: 'フレンドではない相手には送れません',
  already_member: 'すでにこのルームのメンバーです',
  room_closed: 'このルームは終了しています',
  full: 'ルームが満員です',
  self_invite: '自分自身は招待できません',
  not_configured: '招待の送信に失敗しました。もう一度お試しください。',
}

const PRESENCE_LABEL: Record<'online' | 'playing' | 'offline', string> = {
  online: '🟢 ONLINE',
  playing: '⚔️ PLAYING',
  offline: '● OFFLINE',
}
const PRESENCE_CLASS: Record<'online' | 'playing' | 'offline', string> = {
  online: 'text-emerald-300',
  playing: 'text-amber-300',
  offline: 'text-white/35',
}

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 27-31）: フレンド一覧画面。
 * フレンドコードの共有・申請の送信/承認/拒否・一覧（プレゼンス付き）・「ルームに招待」
 * の起点をこの1画面に集約する。
 *
 * ログイン不要の既存方針を維持——フレンドコード自体が「人に共有できる短い識別子」
 * （battle/roomCode.tsと同じ生成方式）であり、メール/パスワードは一切要求しない。
 */
export function FriendsHomeScreen({
  onBack,
  onHome,
  playerId,
  hasPass,
  presenceSnapshot,
  onSubscribePresence,
  onOpenFriendProfile,
  onRequirePass,
  onInviteToExistingRoom,
  onCreateRoomAndInvite,
}: Props) {
  const [myCode, setMyCode] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([])
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [inviteToast, setInviteToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)

  async function reload() {
    const [code, requests, friendList] = await Promise.all([
      getOrCreateFriendCode(playerId).then((r) => (r.ok ? r.code : null)),
      listIncomingFriendRequests(playerId),
      listFriends(playerId),
    ])
    setMyCode(code)
    setIncoming(requests)
    setFriends(friendList)
    onSubscribePresence(friendList.map((f) => f.playerId))
    if (hasPass) setActiveRoomCode(await getActiveRoomForHost(playerId))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSendRequest() {
    const code = codeInput.trim().toUpperCase()
    if (code.length === 0) return
    setRequestMessage(null)
    const res = await sendFriendRequest(playerId, code)
    if (res.ok) {
      setCodeInput('')
      setRequestMessage(res.status === 'already_friends' ? 'もう友達になりました！' : '申請を送りました')
      reload()
      return
    }
    const reasonLabel: Record<string, string> = {
      invalid_code: 'そのフレンドコードは見つかりません',
      self_request: '自分自身には申請できません',
      already_friends: 'もう友達です',
      already_pending: 'すでに申請済みです',
      not_configured: '現在この機能は利用できません',
    }
    setRequestMessage(reasonLabel[res.reason] ?? '申請を送れませんでした')
  }

  async function handleRespond(requestId: string, action: 'accept' | 'reject') {
    setBusyRequestId(requestId)
    await respondToFriendRequest(requestId, playerId, action)
    setBusyRequestId(null)
    reload()
  }

  /**
   * 次フェーズ（item 75-77）: 実際に報告されたバグ（オフラインの相手にはボタン自体が
   * 出ず、一生招待できなかった）の修正。プレゼンス状態はもう一切見ない——クリック自体は
   * 常に試行でき、適格性はサーバー側（POST /api/rooms/private/:roomCode/invite）が判断する。
   */
  async function handleInviteClick(friend: FriendSummary) {
    if (!hasPass) {
      onRequirePass()
      return
    }
    setBusyInviteId(friend.playerId)
    const result = activeRoomCode ? await onInviteToExistingRoom(friend.playerId, activeRoomCode) : await onCreateRoomAndInvite(friend.playerId)
    setBusyInviteId(null)
    if (result.ok) {
      setInvitedIds((prev) => new Set(prev).add(friend.playerId))
      setInviteToast({ message: `${friend.profile.nickname}に招待を送りました`, kind: 'success' })
    } else {
      setInviteToast({ message: INVITE_ERROR_REASON_LABEL[result.reason ?? ''] ?? '招待の送信に失敗しました。もう一度お試しください。', kind: 'error' })
    }
    setTimeout(() => setInviteToast(null), 2600)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <NavBar onBack={onBack} onHome={onHome} />

      <div className="flex flex-1 flex-col items-center gap-5 px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-white">👥 FRIENDS</h1>

        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-3 text-center">
          <p className="text-[10px] font-bold tracking-widest text-white/40">あなたのフレンドコード</p>
          <p className="text-2xl font-black tracking-[0.2em] text-fuchsia-300">{myCode ?? '----'}</p>
          <p className="text-[10px] text-white/30">このコードを友達に伝えて追加してもらいましょう</p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          <p className="text-[10px] font-black tracking-widest text-white/40">コードで友達を追加</p>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="例: AB23CD"
              maxLength={10}
              className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 text-center text-lg font-black tracking-[0.15em] text-white outline-none"
            />
            <button
              onClick={() => {
                sfx.uiTap()
                handleSendRequest()
              }}
              className="rounded-xl bg-gradient-to-b from-fuchsia-500 to-purple-600 px-4 text-sm font-black text-white active:scale-95"
            >
              申請
            </button>
          </div>
          {requestMessage && <p className="text-center text-[11px] font-bold text-amber-300">{requestMessage}</p>}
        </div>

        {incoming.length > 0 && (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-[10px] font-black tracking-widest text-white/40">届いている申請（{incoming.length}）</p>
            {incoming.map((req) => (
              <div key={req.requestId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <span className="text-xl">{resolveAvatarEmoji(req.fromProfile.avatar)}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-black text-white">{req.fromProfile.nickname}</p>
                <button
                  onClick={() => {
                    sfx.uiTap()
                    handleRespond(req.requestId, 'accept')
                  }}
                  disabled={busyRequestId === req.requestId}
                  className="rounded-full bg-emerald-500/80 px-2.5 py-1 text-[11px] font-black text-white active:scale-95 disabled:opacity-50"
                >
                  承認
                </button>
                <button
                  onClick={() => {
                    sfx.uiTap()
                    handleRespond(req.requestId, 'reject')
                  }}
                  disabled={busyRequestId === req.requestId}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/60 active:scale-95 disabled:opacity-50"
                >
                  拒否
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="w-full max-w-xs flex-1 space-y-2">
          <p className="text-[10px] font-black tracking-widest text-white/40">フレンド（{friends.length}）</p>
          {inviteToast && (
            <p className={`text-center text-[11px] font-bold ${inviteToast.kind === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {inviteToast.message}
            </p>
          )}
          {friends.length === 0 && <p className="mt-6 text-center text-sm font-bold text-white/40">まだフレンドがいません</p>}
          {friends.map((friend) => {
            const presence = presenceSnapshot[friend.playerId] ?? friend.presence
            const invited = invitedIds.has(friend.playerId)
            return (
              <div key={friend.playerId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                <span className="text-xl">{resolveAvatarEmoji(friend.profile.avatar)}</span>
                <div className="min-w-0 flex-1 text-left">
                  <button
                    onClick={() => {
                      sfx.uiTap()
                      onOpenFriendProfile(friend.playerId)
                    }}
                    className="block truncate text-sm font-black text-white active:opacity-70"
                  >
                    {friend.profile.nickname}
                  </button>
                  <p className={`text-[10px] font-bold ${PRESENCE_CLASS[presence]}`}>{PRESENCE_LABEL[presence]}</p>
                </div>
                <button
                  onClick={() => {
                    sfx.uiTap()
                    onOpenFriendProfile(friend.playerId)
                  }}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70 active:scale-95"
                >
                  プロフィール
                </button>
                {/*
                  次フェーズ（item 75-77）: プレゼンス（オンライン状態）に関わらず常に
                  このボタンを出す——実際に報告されたバグ（オフラインだとボタン自体が
                  消え、一生招待できなかった）の修正。適格性はクリック後、サーバー側が判断する。
                */}
                <button
                  onClick={() => {
                    sfx.uiTap()
                    handleInviteClick(friend)
                  }}
                  disabled={busyInviteId === friend.playerId || invited}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black active:scale-95 disabled:opacity-50 ${
                    hasPass ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {!hasPass
                    ? '🔒 ルームに招待'
                    : invited
                      ? '招待済み'
                      : busyInviteId === friend.playerId
                        ? '送信中…'
                        : activeRoomCode
                          ? 'ルームに招待'
                          : 'ルームを作成して招待'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
