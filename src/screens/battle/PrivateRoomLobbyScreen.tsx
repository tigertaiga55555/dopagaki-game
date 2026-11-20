import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { resolveAvatarEmoji } from '../../config/profileConfig'
import { connectToPrivateRoom, type PrivateRoomSocket } from '../../battle/privateRoomClient'
import { buildPrivateRoomUrl } from '../../battle/privateRoomUrl'
import type { PrivateRoomMember, PrivateRoomState } from '../../battle/privateRoomEngine'
import type { BattleFormat, BattleOpponentProfile } from '../../battle/types'
import type { EndlessDifficulty } from '../../types'

interface Props {
  roomCode: string
  playerId: string
  myProfile: BattleOpponentProfile
  /** ロビーを抜ける（自分の意思で退出、またはhostがルームを閉じた）。 */
  onLeave: () => void
  /** 自分がホストに選ばれた2人のうちの1人になった瞬間に呼ぶ（App.tsx側が実際の対戦画面へ切り替える）。 */
  onEnterMatch: (args: {
    matchId: string
    battleType: BattleFormat
    endlessDifficulty: EndlessDifficulty | null
    opponentProfile: BattleOpponentProfile
  }) => void
}

const DIFFICULTY_LABEL: Record<EndlessDifficulty, string> = { beginner: '初級', intermediate: '中級', advanced: '上級' }

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: PRIVATE ROOMのロビー画面。
 * 仕様セクション11の最小表示（ROOM CODE・HOST・メンバー一覧（対戦中/待機中）・
 * ホスト専用の「対戦を組む」「ルームを閉じる」・退出）を満たす。
 *
 * 実際の対戦（NORMAL/ENDLESS）はこの画面では一切描画しない——activeMatchに自分が
 * 選ばれたことを検知した瞬間、onEnterMatchでApp.tsxへ委譲し、既存のBattleMatchScreen
 * （NORMAL、既存の1v1エンジンそのまま）または新規のPrivateEndlessMatchScreen
 * （ENDLESS、既存のBattleRoom DO・WS接続・endlessBattleProblemSet.tsをそのまま使う）が
 * 入れ替わりで表示を引き継ぐ。
 */
export function PrivateRoomLobbyScreen({ roomCode, playerId, myProfile, onLeave, onEnterMatch }: Props) {
  const [roomState, setRoomState] = useState<PrivateRoomState | null>(null)
  const [connError, setConnError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [battleType, setBattleType] = useState<BattleFormat>('normal')
  const [endlessDifficulty, setEndlessDifficulty] = useState<EndlessDifficulty>('beginner')
  const [starting, setStarting] = useState(false)

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
          const active = msg.state.activeMatch
          if (active && (active.memberAId === playerId || active.memberBId === playerId) && enteredMatchRef.current !== active.matchId) {
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
          onLeave()
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

  const isHost = roomState?.hostPlayerId === playerId
  const members = roomState?.members ?? []
  const activeMatch = roomState?.activeMatch ?? null

  function toggleSelected(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  function handleStartMatch() {
    if (selected.length !== 2) return
    setStarting(true)
    socketRef.current?.send({
      v: 1,
      type: 'start_match',
      memberAId: selected[0],
      memberBId: selected[1],
      battleType,
      endlessDifficulty: battleType === 'endless' ? endlessDifficulty : null,
    })
    setPickerOpen(false)
    setStarting(false)
  }

  function handleCloseRoom() {
    socketRef.current?.send({ v: 1, type: 'close_room' })
  }

  function handleLeave() {
    socketRef.current?.close()
    onLeave()
  }

  if (!roomState) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <BackButton onBack={handleLeave} label="戻る" />
        <p className="text-sm font-bold text-white/60">ロビーに接続しています…</p>
        {connError && <p className="text-xs font-bold text-rose-300">{connError}</p>}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={handleLeave} label="退出" />

      <div className="flex flex-1 flex-col items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-black tracking-widest text-fuchsia-300">PRIVATE ROOM</h1>

        <div className="w-full max-w-xs space-y-1 rounded-2xl bg-white/5 px-4 py-3 text-center">
          <p className="text-[10px] font-bold tracking-widest text-white/40">ROOM CODE</p>
          <p className="text-2xl font-black tracking-[0.2em] text-fuchsia-300">{roomCode}</p>
          <p className="break-all text-[10px] text-white/30">{buildPrivateRoomUrl(roomCode)}</p>
        </div>

        {connError && <p className="text-xs font-bold text-rose-300">{connError}</p>}

        {activeMatch && (
          <p className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-[11px] font-bold text-fuchsia-300">
            対戦中: {members.find((m) => m.playerId === activeMatch.memberAId)?.profile.nickname ?? '?'} vs{' '}
            {members.find((m) => m.playerId === activeMatch.memberBId)?.profile.nickname ?? '?'}
            {activeMatch.battleType === 'endless' && activeMatch.endlessDifficulty && ` (ENDLESS ${DIFFICULTY_LABEL[activeMatch.endlessDifficulty]})`}
          </p>
        )}

        <div className="w-full max-w-xs space-y-2">
          <p className="text-[10px] font-black tracking-widest text-white/40">メンバー（{members.length}人）</p>
          {members.map((m) => (
            <MemberRow key={m.playerId} member={m} isHost={m.playerId === roomState.hostPlayerId} inMatch={isMemberInMatch(m, activeMatch)} />
          ))}
        </div>

        {isHost && (
          <div className="flex w-full max-w-xs flex-col gap-2">
            {!activeMatch && (
              <button
                onClick={() => setPickerOpen(true)}
                disabled={members.length < 2}
                className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-3.5 text-sm font-black tracking-widest text-white active:scale-95 disabled:opacity-50"
              >
                対戦を組む
              </button>
            )}
            <button
              onClick={handleCloseRoom}
              className="w-full rounded-2xl border border-rose-400/40 bg-rose-500/10 py-3 text-sm font-bold text-rose-300 active:scale-95"
            >
              ルームを閉じる
            </button>
          </div>
        )}
      </div>

      {pickerOpen && (
        <MemberPickerModal
          members={members}
          selected={selected}
          battleType={battleType}
          endlessDifficulty={endlessDifficulty}
          starting={starting}
          onToggle={toggleSelected}
          onChangeBattleType={setBattleType}
          onChangeDifficulty={setEndlessDifficulty}
          onStart={handleStartMatch}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

function isMemberInMatch(member: PrivateRoomMember, activeMatch: PrivateRoomState['activeMatch']): boolean {
  if (!activeMatch) return false
  return activeMatch.memberAId === member.playerId || activeMatch.memberBId === member.playerId
}

function MemberRow({ member, isHost, inMatch }: { member: PrivateRoomMember; isHost: boolean; inMatch: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
      <span className="text-xl">{resolveAvatarEmoji(member.profile.avatar)}</span>
      <div className="min-w-0 flex-1 text-left">
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
    </div>
  )
}

function MemberPickerModal({
  members,
  selected,
  battleType,
  endlessDifficulty,
  starting,
  onToggle,
  onChangeBattleType,
  onChangeDifficulty,
  onStart,
  onClose,
}: {
  members: PrivateRoomMember[]
  selected: string[]
  battleType: BattleFormat
  endlessDifficulty: EndlessDifficulty
  starting: boolean
  onToggle: (id: string) => void
  onChangeBattleType: (type: BattleFormat) => void
  onChangeDifficulty: (difficulty: EndlessDifficulty) => void
  onStart: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-white/10 bg-[#1a0e2e] p-5 text-left shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-3 text-center text-sm font-black text-white">対戦を組む（2人選択）</p>

        <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
          {members.map((m) => {
            const isSelected = selected.includes(m.playerId)
            const atCap = !isSelected && selected.length >= 2
            return (
              <button
                key={m.playerId}
                onClick={() => onToggle(m.playerId)}
                disabled={atCap}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold ${
                  isSelected ? 'bg-fuchsia-500/20 text-fuchsia-200' : atCap ? 'text-white/20' : 'text-white/70 active:bg-white/10'
                }`}
              >
                <span>{m.profile.nickname}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => onChangeBattleType('normal')}
            className={`flex-1 rounded-xl py-2 text-xs font-black ${battleType === 'normal' ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/5 text-white/40'}`}
          >
            NORMAL
          </button>
          <button
            onClick={() => onChangeBattleType('endless')}
            className={`flex-1 rounded-xl py-2 text-xs font-black ${battleType === 'endless' ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/5 text-white/40'}`}
          >
            ENDLESS
          </button>
        </div>

        {battleType === 'endless' && (
          <div className="mb-3 flex gap-2">
            {(['beginner', 'intermediate', 'advanced'] as EndlessDifficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => onChangeDifficulty(d)}
                className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold ${
                  endlessDifficulty === d ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'bg-white/5 text-white/40'
                }`}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onStart}
          disabled={selected.length !== 2 || starting}
          className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-3 text-sm font-black text-white active:scale-95 disabled:opacity-50"
        >
          対戦開始
        </button>
      </div>
    </div>
  )
}
