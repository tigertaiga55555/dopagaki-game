import { useEffect, useRef, useState } from 'react'
import { NavBar } from '../../components/NavBar'
import { resolveAvatarEmoji } from '../../config/profileConfig'
import { listFriends } from '../../friends/friendsClient'
import type { FriendSummary } from '../../friends/types'
import { connectToPrivateRoom, getOutgoingRoomInvites, type PrivateRoomSocket } from '../../battle/privateRoomClient'
import { buildPrivateRoomUrl } from '../../battle/privateRoomUrl'
import { PRIVATE_ROOM_MAX_MEMBERS, visibleTableCount, type PrivateRoomMember, type PrivateRoomState, type PrivateRoomTable } from '../../battle/privateRoomEngine'
import type { RoomClosedReason } from '../../battle/privateRoomTypes'
import type { BattleFormat, BattleOpponentProfile } from '../../battle/types'
import type { EndlessDifficulty } from '../../types'

interface Props {
  roomCode: string
  playerId: string
  myProfile: BattleOpponentProfile
  /** 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 46-47）: 「← 戻る」は常にスタックを1つpopするだけ——部屋を抜ける操作ではない。 */
  onBack: () => void
  /** 「⌂ ホーム」も同様、部屋への参加状態には一切影響しない（サーバー側で参加状態が維持される）。 */
  onHome: () => void
  /** ホストによる明示的なclose、または6時間無活動の期限切れでだけ呼ばれる——本当に部屋が消えた時だけの通知。 */
  onRoomClosed: (reason: RoomClosedReason) => void
  /** 自分が座ったTABLEの両座席がREADYになった瞬間に呼ぶ（App.tsx側が実際の対戦画面へ切り替える）。 */
  onEnterMatch: (args: {
    matchId: string
    battleType: BattleFormat
    endlessDifficulty: EndlessDifficulty | null
    opponentProfile: BattleOpponentProfile
  }) => void
  /**
   * 次フェーズ（item 15、実機/E2Eで発見した競合の修正）: このmatchIdへは既に入って
   * 戻ってきた（App.tsx側で記憶している）かどうか。このコンポーネント自身のuseRefは
   * 再マウントごとに失われるため、サーバー側のactiveMatchがまだ更新途中の一時的な
   * stale値を受け取っても、既に退出済みの試合へ二度と入らないことを保証する。
   */
  isMatchAlreadyHandled: (matchId: string) => boolean
  /**
   * 次フェーズ（item 75-77）: 戻り値で成否・理由を返す（トースト・per-friend状態表示に使う）。
   * item 75-77で判明した実バグの修正により、招待可否はもうプレゼンス（オンライン状態）を
   * 一切見ない——presenceSnapshot/onSubscribePresenceはこの画面ではもう不要になった。
   */
  onInviteFriend: (toPlayerId: string) => Promise<{ ok: boolean; reason?: string }>
  /** 次フェーズ（item 48）: メンバーカードをタップした時、FriendProfileScreenを開く。 */
  onOpenMemberProfile: (playerId: string) => void
}

const DIFFICULTY_LABEL: Record<EndlessDifficulty, string> = { beginner: '初級', intermediate: '中級', advanced: '上級' }
const WINNER_LABEL: Record<'a' | 'b' | 'draw', string> = { a: 'A勝利', b: 'B勝利', draw: 'DRAW' }

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 次フェーズ（FRIENDS/TABLE/ナビ追加調整ラウンド、item 42-48/50）: 「友達と対戦」のロビー画面。
 *
 * item 43（最大の変更点）: 旧「ホストが都度2人を選んで対戦を組む」方式を廃止し、
 * 最大4つのTABLE（各2席）を常設——誰でも空席にENTRYでき、座った2人が共同でルールを選び、
 * 両者がREADYになった瞬間にサーバー側が自動的に対戦を開始する。ホストの役割は
 * 「ルームを閉じる」権限だけに縮小された。
 *
 * item 42: 画面上に"PRIVATE ROOM"という内部コード名は一切出さない（内部のデータモデル・
 * ファイル名としては引き続きPrivateRoomのまま——ユーザー向け文言だけを分離する）。
 */
export function PrivateRoomLobbyScreen({
  roomCode,
  playerId,
  myProfile,
  onBack,
  onHome,
  onRoomClosed,
  onEnterMatch,
  isMatchAlreadyHandled,
  onInviteFriend,
  onOpenMemberProfile,
}: Props) {
  const [roomState, setRoomState] = useState<PrivateRoomState | null>(null)
  const [connError, setConnError] = useState<string | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  const socketRef = useRef<PrivateRoomSocket | null>(null)
  const enteredMatchRef = useRef<string | null>(null)

  useEffect(() => {
    const socket = connectToPrivateRoom(
      roomCode,
      playerId,
      myProfile,
      (msg) => {
        if (msg.type === 'room_state') {
          setRoomState(msg.state)
          const myTable = msg.state.tables.find((t) => t.activeMatch && (t.activeMatch.memberAId === playerId || t.activeMatch.memberBId === playerId))
          const active = myTable?.activeMatch
          if (active && enteredMatchRef.current !== active.matchId && !isMatchAlreadyHandled(active.matchId)) {
            enteredMatchRef.current = active.matchId
            const opponentId = active.memberAId === playerId ? active.memberBId : active.memberAId
            const opponent = msg.state.members.find((m) => m.playerId === opponentId)
            if (opponent) {
              onEnterMatch({
                matchId: active.matchId,
                battleType: active.battleType,
                endlessDifficulty: active.endlessDifficulty,
                opponentProfile: opponent.profile,
              })
            }
          }
        } else if (msg.type === 'room_closed') {
          onRoomClosed(msg.reason)
        } else if (msg.type === 'error') {
          setConnError(msg.message)
        }
      },
      () => {},
    )
    socketRef.current = socket
    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  /**
   * 次フェーズ（item 15、実機/E2Eで発見した耐障害性の改善）: サーバーからのroom_state
   * push配信だけに依存せず、定期的に能動的な再取得（request_state）も行う——pushが
   * 何らかの理由で届かなかった場合でも、このロビーが「対戦が終わったのに表示が古いまま」
   * から自動的に復帰できるようにするための二重の経路。ロビーが表示されている間だけ動く。
   * item 45: request_stateはサーバー側でlastActivityAtを更新しない（単なる接続維持の
   * ポーリングは「活動」ではない、というユーザーの明示指示）。
   */
  useEffect(() => {
    const interval = setInterval(() => {
      socketRef.current?.send({ v: 1, type: 'request_state' })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  if (!roomState) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <NavBar onBack={onBack} onHome={onHome} />
        <p className="text-sm font-bold text-white/60">ロビーに接続しています…</p>
        {connError && <p className="text-xs font-bold text-rose-300">{connError}</p>}
      </div>
    )
  }

  const isHost = roomState.hostPlayerId === playerId
  const members = roomState.members
  const myTable = members.length > 0 ? roomState.tables.find((t) => t.seatAId === playerId || t.seatBId === playerId) : undefined
  const tablesToShow = roomState.tables.slice(0, visibleTableCount(members.length))

  function sendMessage(message: Parameters<PrivateRoomSocket['send']>[0]) {
    socketRef.current?.send(message)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <NavBar onBack={onBack} onHome={onHome} />

      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-fuchsia-300">🤝 友達と対戦</h1>

        <div className="w-full max-w-xs space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-center">
          <p className="text-[10px] font-bold tracking-widest text-white/40">ROOM CODE</p>
          <p className="text-2xl font-black tracking-[0.2em] text-fuchsia-300">{roomCode}</p>
          <p className="break-all text-[10px] text-white/30">{buildPrivateRoomUrl(roomCode)}</p>
        </div>

        {/*
          次フェーズ（item 75-77）: 「フレンドを招待」はルームのホストだけが行える
          （このラウンドで明文化された正しい適格性ルール——以前は誰でも押せたが、
          サーバー側（POST /api/rooms/private/:roomCode/invite）もnot_hostで拒否する
          ため、非ホストにはボタン自体を出さず「押せるのに必ず失敗する」UIにしない）。
        */}
        {isHost && (
          <button
            onClick={() => setInviteModalOpen(true)}
            className="w-full max-w-xs rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 py-2.5 text-sm font-black text-fuchsia-200 active:scale-95"
          >
            👥 フレンドを招待
          </button>
        )}

        {connError && <p className="text-xs font-bold text-rose-300">{connError}</p>}

        <div className="w-full max-w-xs space-y-2">
          <p className="text-[10px] font-black tracking-widest text-white/40">メンバー（{members.length}人）</p>
          {members.map((m) => (
            <MemberRow
              key={m.playerId}
              member={m}
              isHost={m.playerId === roomState.hostPlayerId}
              isSelf={m.playerId === playerId}
              inMatch={roomState.tables.some((t) => t.activeMatch && (t.activeMatch.memberAId === m.playerId || t.activeMatch.memberBId === m.playerId))}
              onOpenProfile={() => onOpenMemberProfile(m.playerId)}
            />
          ))}
        </div>

        <div className="w-full max-w-xs space-y-3">
          <p className="text-[10px] font-black tracking-widest text-white/40">対戦テーブル</p>
          {tablesToShow.map((table) => (
            <TableCard
              key={table.tableId}
              table={table}
              members={members}
              myPlayerId={playerId}
              myTableId={myTable?.tableId ?? null}
              onEnter={() => sendMessage({ v: 1, type: 'enter_table', tableId: table.tableId })}
              onLeave={() => sendMessage({ v: 1, type: 'leave_table' })}
              onSetRules={(battleType, endlessDifficulty) =>
                sendMessage({ v: 1, type: 'set_table_rules', tableId: table.tableId, battleType, endlessDifficulty })
              }
              onSetReady={(ready) => sendMessage({ v: 1, type: 'set_table_ready', tableId: table.tableId, ready })}
            />
          ))}
        </div>

        {roomState.matchHistory.length > 0 && (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-[10px] font-black tracking-widest text-white/40">対戦履歴（新しい順）</p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {roomState.matchHistory.map((entry) => (
                <div key={entry.matchId} className="rounded-xl bg-white/5 px-3 py-2 text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-white/40">
                      {formatClockTime(entry.finishedAt)} ・ TABLE{entry.tableId} ・ {entry.battleType === 'endless' ? 'ENDLESS' : 'NORMAL'}
                      {entry.battleType === 'endless' && entry.endlessDifficulty && ` ${DIFFICULTY_LABEL[entry.endlessDifficulty]}`}
                    </p>
                    <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[9px] font-black text-fuchsia-300">{WINNER_LABEL[entry.winner]}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-white">
                    {entry.playerANickname}
                    {entry.playerAFinalDopaPercent !== undefined && <span className="ml-1 text-white/50">{entry.playerAFinalDopaPercent}%</span>}
                    {entry.playerAStreak !== undefined && <span className="ml-1 text-white/50">{entry.playerAStreak}連続</span>}
                    <span className="mx-1.5 text-white/30">vs</span>
                    {entry.playerBNickname}
                    {entry.playerBFinalDopaPercent !== undefined && <span className="ml-1 text-white/50">{entry.playerBFinalDopaPercent}%</span>}
                    {entry.playerBStreak !== undefined && <span className="ml-1 text-white/50">{entry.playerBStreak}連続</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isHost && (
          <button
            onClick={() => setCloseConfirmOpen(true)}
            className="w-full max-w-xs rounded-2xl border border-rose-400/40 bg-rose-500/10 py-3 text-sm font-bold text-rose-300 active:scale-95"
          >
            ルームを閉じる
          </button>
        )}
      </div>

      {closeConfirmOpen && (
        <ConfirmCloseModal
          onConfirm={() => {
            sendMessage({ v: 1, type: 'close_room' })
            setCloseConfirmOpen(false)
          }}
          onCancel={() => setCloseConfirmOpen(false)}
        />
      )}

      {inviteModalOpen && (
        <InviteFriendModal
          playerId={playerId}
          roomCode={roomCode}
          memberPlayerIds={members.map((m) => m.playerId)}
          roomFull={members.length >= PRIVATE_ROOM_MAX_MEMBERS}
          onInvite={async (toPlayerId) => {
            const result = await onInviteFriend(toPlayerId)
            if (result.ok) sendMessage({ v: 1, type: 'touch_activity' })
            return result
          }}
          onClose={() => setInviteModalOpen(false)}
        />
      )}
    </div>
  )
}

function MemberRow({
  member,
  isHost,
  isSelf,
  inMatch,
  onOpenProfile,
}: {
  member: PrivateRoomMember
  isHost: boolean
  isSelf: boolean
  inMatch: boolean
  onOpenProfile: () => void
}) {
  return (
    <button
      onClick={onOpenProfile}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left active:scale-[0.98] ${
        // item 48/60: 「これは自分」を、ホストの👑クラウンとは明確に別の見た目（フクシアのring+背景）で
        // 一目で分かるようにする——host表示との混同を避ける。item 60: 視覚だけで区別させる
        // というユーザー指示により、"YOU"等のテキストラベルは一切付けない（ring/背景/avatar ringのみ）。
        isSelf ? 'bg-fuchsia-500/15 ring-1 ring-fuchsia-400/60' : 'bg-white/5'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl ${isSelf ? 'ring-2 ring-fuchsia-400/70' : ''}`}>
        {resolveAvatarEmoji(member.profile.avatar)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">
          {member.profile.nickname}
          {isHost && <span className="ml-1.5 text-[10px] font-black text-amber-300">👑 ホスト</span>}
        </p>
        <p className="text-[10px] text-white/40">
          {member.stats.wins}勝 {member.stats.losses}敗 {member.stats.draws}分 {!member.connected && '・切断中'}
        </p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${inMatch ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-white/10 text-white/40'}`}>
        {inMatch ? '対戦中' : '待機中'}
      </span>
    </button>
  )
}

/**
 * item 43: 1つのTABLE。誰でも空席にENTRYできる、座った2人が共同でルールを選びREADYする。
 * 既に自分が別のTABLEに座っている間は、他のTABLEのENTRYボタンを無効化する
 * （leave_tableで先に離席してもらう、という明示的な操作を要求する設計）。
 */
function TableCard({
  table,
  members,
  myPlayerId,
  myTableId,
  onEnter,
  onLeave,
  onSetRules,
  onSetReady,
}: {
  table: PrivateRoomTable
  members: PrivateRoomMember[]
  myPlayerId: string
  myTableId: number | null
  onEnter: () => void
  onLeave: () => void
  onSetRules: (battleType: BattleFormat, endlessDifficulty: EndlessDifficulty | null) => void
  onSetReady: (ready: boolean) => void
}) {
  const seatAMember = table.seatAId ? members.find((m) => m.playerId === table.seatAId) : null
  const seatBMember = table.seatBId ? members.find((m) => m.playerId === table.seatBId) : null
  const mySeated = table.seatAId === myPlayerId || table.seatBId === myPlayerId
  const seatedElsewhere = myTableId !== null && myTableId !== table.tableId
  const inMatch = table.activeMatch !== null
  const iAmReady = table.readyPlayerIds.includes(myPlayerId)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black tracking-widest text-white/70">TABLE {table.tableId}</p>
        {inMatch && <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-black text-fuchsia-300">対戦中</span>}
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Seat member={seatAMember} ready={table.seatAId ? table.readyPlayerIds.includes(table.seatAId) : false} onEnter={onEnter} disabled={seatedElsewhere} />
        <Seat member={seatBMember} ready={table.seatBId ? table.readyPlayerIds.includes(table.seatBId) : false} onEnter={onEnter} disabled={seatedElsewhere} />
      </div>

      {mySeated && !inMatch && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => onSetRules('normal', null)}
              className={`flex-1 rounded-xl py-2 text-xs font-black ${
                table.battleType === 'normal' ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/5 text-white/40'
              }`}
            >
              NORMAL
            </button>
            <button
              onClick={() => onSetRules('endless', table.endlessDifficulty ?? 'beginner')}
              className={`flex-1 rounded-xl py-2 text-xs font-black ${
                table.battleType === 'endless' ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/5 text-white/40'
              }`}
            >
              ENDLESS
            </button>
          </div>
          {table.battleType === 'endless' && (
            <div className="flex gap-1.5">
              {(['beginner', 'intermediate', 'advanced'] as EndlessDifficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onSetRules('endless', d)}
                  className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold ${
                    table.endlessDifficulty === d ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/5 text-white/40'
                  }`}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onSetReady(!iAmReady)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black active:scale-95 ${
                iAmReady ? 'bg-emerald-500/80 text-black' : 'bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white'
              }`}
            >
              {iAmReady ? 'READY済み（キャンセル）' : 'READY'}
            </button>
            <button onClick={onLeave} className="rounded-xl border border-white/15 px-3 text-xs font-bold text-white/60 active:scale-95">
              離席
            </button>
          </div>
        </div>
      )}

      {!mySeated && (table.seatAId || table.seatBId) && !inMatch && (
        <p className="text-center text-[11px] font-bold text-white/40">
          {table.battleType === 'endless' ? `ENDLESS ${table.endlessDifficulty ? DIFFICULTY_LABEL[table.endlessDifficulty] : ''}` : 'NORMAL'} ・ READY{' '}
          {table.readyPlayerIds.length}/2
        </p>
      )}
    </div>
  )
}

function Seat({
  member,
  ready,
  onEnter,
  disabled,
}: {
  member: PrivateRoomMember | null | undefined
  ready: boolean
  onEnter: () => void
  disabled: boolean
}) {
  if (!member) {
    return (
      <button
        onClick={onEnter}
        disabled={disabled}
        className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-white/15 text-xs font-bold text-white/40 active:scale-95 disabled:opacity-30"
      >
        <span>＋</span>
        <span>ENTRY</span>
      </button>
    )
  }
  return (
    <div className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/5">
      <span className="text-lg">{resolveAvatarEmoji(member.profile.avatar)}</span>
      <p className="max-w-full truncate px-1 text-[11px] font-bold text-white">{member.profile.nickname}</p>
      <p className={`text-[9px] font-black ${ready ? 'text-emerald-300' : 'text-white/30'}`}>{ready ? 'READY' : '未READY'}</p>
    </div>
  )
}

function ConfirmCloseModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6" onClick={onCancel}>
      <div className="anim-pop w-full max-w-xs rounded-3xl border border-rose-400/30 bg-[#1a0e2e] p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm font-black text-white">このルームを閉じますか？</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white active:scale-95">
            キャンセル
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-rose-500/90 py-2.5 text-sm font-black text-white active:scale-95">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

type InviteFriendRowState = 'idle' | 'sending' | 'invited' | 'error'

const ERROR_REASON_LABEL: Record<string, string> = {
  not_host: 'ホストだけがフレンドを招待できます',
  not_friends: 'フレンドではない相手には送れません',
  already_member: 'すでにこのルームのメンバーです',
  room_closed: 'このルームは終了しています',
  full: 'ルームが満員です',
  self_invite: '自分自身は招待できません',
  not_configured: '招待の送信に失敗しました。もう一度お試しください。',
}

/**
 * item 50（→item 75-77で実バグ修正）: ルームの中からフレンドを招待する
 * （FriendsHomeScreenの導線とは別の起点、送受信の仕組みは共通）。
 *
 * item 75-77: 以前はpresence（オンライン状態）だけで「招待」ボタンの活性/非活性を
 * 決めていたため、相手がオフラインだと構造的に一生招待できなかった（実際に報告された
 * バグ）。プレゼンスを一切見ない正しい適格性（参加中／既に招待済み／満員）だけで
 * per-friendの状態を決め、送信自体はオンライン/オフラインに関わらず常に試せるようにする。
 */
function InviteFriendModal({
  playerId,
  roomCode,
  memberPlayerIds,
  roomFull,
  onInvite,
  onClose,
}: {
  playerId: string
  roomCode: string
  memberPlayerIds: string[]
  roomFull: boolean
  onInvite: (toPlayerId: string) => Promise<{ ok: boolean; reason?: string }>
  onClose: () => void
}) {
  const [friends, setFriends] = useState<FriendSummary[] | null>(null)
  const [outgoingInvited, setOutgoingInvited] = useState<Set<string>>(new Set())
  const [rowState, setRowState] = useState<Record<string, InviteFriendRowState>>({})
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)

  useEffect(() => {
    listFriends(playerId).then(setFriends)
    getOutgoingRoomInvites(roomCode).then((ids) => setOutgoingInvited(new Set(ids)))
  }, [playerId, roomCode])

  async function handleInvite(friend: FriendSummary) {
    setRowState((s) => ({ ...s, [friend.playerId]: 'sending' }))
    const result = await onInvite(friend.playerId)
    if (result.ok) {
      setRowState((s) => ({ ...s, [friend.playerId]: 'invited' }))
      setOutgoingInvited((prev) => new Set(prev).add(friend.playerId))
      setToast({ message: `${friend.profile.nickname}に招待を送りました`, kind: 'success' })
    } else {
      setRowState((s) => ({ ...s, [friend.playerId]: 'error' }))
      setToast({ message: ERROR_REASON_LABEL[result.reason ?? ''] ?? '招待の送信に失敗しました。もう一度お試しください。', kind: 'error' })
    }
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div className="anim-pop w-full max-w-xs rounded-3xl border border-white/10 bg-[#1a0e2e] p-5 text-left" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center text-sm font-black text-white">フレンドを招待</p>
        {toast && (
          <p className={`mb-2 text-center text-xs font-bold ${toast.kind === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{toast.message}</p>
        )}
        {friends === null && <p className="text-center text-xs font-bold text-white/50">読み込み中…</p>}
        {friends !== null && friends.length === 0 && <p className="text-center text-xs font-bold text-white/40">まだフレンドがいません</p>}
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {friends?.map((f) => {
            const isMember = memberPlayerIds.includes(f.playerId)
            const isInvited = outgoingInvited.has(f.playerId) || rowState[f.playerId] === 'invited'
            const sending = rowState[f.playerId] === 'sending'
            const label = isMember ? '参加中' : isInvited ? '招待済み' : roomFull ? '満員' : sending ? '送信中…' : '招待'
            const disabled = isMember || isInvited || roomFull || sending
            return (
              <div key={f.playerId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <span className="text-lg">{resolveAvatarEmoji(f.profile.avatar)}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">{f.profile.nickname}</p>
                <button
                  onClick={() => handleInvite(f)}
                  disabled={disabled}
                  className="rounded-full bg-fuchsia-500/30 px-2.5 py-1 text-[10px] font-black text-fuchsia-200 active:scale-95 disabled:opacity-40"
                >
                  {label}
                </button>
              </div>
            )
          })}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-white/70 active:scale-95">
          閉じる
        </button>
      </div>
    </div>
  )
}
