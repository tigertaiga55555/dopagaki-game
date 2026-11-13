import { useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { createFriendRoom, getRoomStatus } from '../../battle/battleClient'
import { normalizeRoomCode, isValidRoomCode } from '../../battle/roomCode'
import { trackBattleFriendRoomCreated, trackBattleFriendRoomJoined } from '../../utils/analytics'

interface Props {
  onBack: () => void
  /** ルームへ入れる状態になった時点で呼ぶ（以後はBattleMatchScreenが実際のWebSocket接続・
   *  ルームコード表示・相手待機UIを持つ）。 */
  onEnterRoom: (roomCode: string) => void
  /** /battle/:roomCode を直接開いた場合、最初から参加入力をスキップしてこのコードで合流を試みる。 */
  initialRoomCode?: string | null
}

type View = 'menu' | 'join_input'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: フレンド対戦の「ルームを作る」「ルームに入る」画面。
 * ルームコードはcrypto.getRandomValues由来（roomCode.ts）で単純な連番ではない。
 */
export function FriendBattleScreen({ onBack, onEnterRoom, initialRoomCode }: Props) {
  const [view, setView] = useState<View>(initialRoomCode ? 'join_input' : 'menu')
  const [codeInput, setCodeInput] = useState(initialRoomCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    setBusy(true)
    setError(null)
    const res = await createFriendRoom()
    setBusy(false)
    if (!res) {
      setError('ルームの作成に失敗しました。もう一度お試しください。')
      return
    }
    trackBattleFriendRoomCreated()
    onEnterRoom(res.roomCode)
  }

  async function handleJoin() {
    const code = normalizeRoomCode(codeInput)
    if (!isValidRoomCode(code)) {
      setError('ルームコードの形式が正しくありません')
      return
    }
    setBusy(true)
    setError(null)
    const status = await getRoomStatus(code)
    setBusy(false)
    if (!status.ok) {
      setError(status.reason === 'not_found' ? 'ルームが見つかりません' : status.reason === 'full' ? 'ルームが満員です' : 'このルームは終了しました')
      return
    }
    trackBattleFriendRoomJoined()
    onEnterRoom(code)
  }

  if (view === 'join_input') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <BackButton onBack={onBack} label="戻る" />
        <p className="text-sm font-bold text-white/70">ルームコードを入力</p>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="例: AB23CD"
          maxLength={10}
          className="w-full max-w-xs rounded-2xl bg-white/10 px-4 py-4 text-center text-2xl font-black tracking-[0.2em] text-white outline-none"
        />
        {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={busy}
          className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 py-4 text-base font-black tracking-widest text-white active:scale-95 disabled:opacity-60"
        >
          参加する
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <BackButton onBack={onBack} label="戻る" />
      <h1 className="text-2xl font-black tracking-widest text-white">フレンド対戦</h1>
      {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
      <div className="flex w-full max-w-xs flex-col gap-4">
        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 py-4 text-base font-black tracking-widest text-white active:scale-95 disabled:opacity-60"
        >
          ルームを作る
        </button>
        <button
          onClick={() => setView('join_input')}
          className="w-full rounded-2xl border border-white/15 bg-white/5 py-4 text-base font-black tracking-widest text-white/85 active:scale-95"
        >
          ルームに入る
        </button>
      </div>
    </div>
  )
}
