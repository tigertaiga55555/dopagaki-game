import { useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { createPrivateRoom, getPrivateRoomStatus } from '../../battle/privateRoomClient'
import { normalizeRoomCode, isValidRoomCode } from '../../battle/roomCode'
import { trackPrivateRoomJoined } from '../../utils/analytics'
import type { BattleOpponentProfile } from '../../battle/types'

interface Props {
  onBack: () => void
  /** 次フェーズ（item 15 PRIVATE ROOM）: 自由に合流できる（free users joining is free for everyone）。 */
  onEnterLobby: (roomCode: string) => void
  /** ルーム作成はDOPA PASS限定（item 18: create-room paywall gate）。無料ユーザーがタップした場合だけ呼ぶ。 */
  onRequirePass: () => void
  hasPass: boolean
  playerId: string
  myProfile: BattleOpponentProfile
  /** /room/:roomCode を直接開いた場合、最初から参加入力をスキップしてこのコードで合流を試みる。 */
  initialRoomCode?: string | null
}

type View = 'menu' | 'join_input'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM）: 「PRIVATE ROOMを作る」
 * 「PRIVATE ROOMに入る」画面。battle/screens/FriendBattleScreen.tsxと同じ構造——
 * ただし「作る」はDOPA PASS限定（free users joining is always free、作成だけが有料）。
 */
export function PrivateRoomHomeScreen({ onBack, onEnterLobby, onRequirePass, hasPass, playerId, myProfile, initialRoomCode }: Props) {
  const [view, setView] = useState<View>(initialRoomCode ? 'join_input' : 'menu')
  const [codeInput, setCodeInput] = useState(initialRoomCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    if (!hasPass) {
      onRequirePass()
      return
    }
    setBusy(true)
    setError(null)
    const res = await createPrivateRoom(playerId, myProfile)
    setBusy(false)
    if (!res) {
      setError('ルームの作成に失敗しました。もう一度お試しください。')
      return
    }
    onEnterLobby(res.roomCode)
  }

  async function handleJoin() {
    const code = normalizeRoomCode(codeInput)
    if (!isValidRoomCode(code)) {
      setError('ルームコードの形式が正しくありません')
      return
    }
    setBusy(true)
    setError(null)
    const status = await getPrivateRoomStatus(code)
    setBusy(false)
    if (!status.ok) {
      setError(status.reason === 'not_found' ? 'ルームが見つかりません' : 'このルームは終了しました')
      return
    }
    trackPrivateRoomJoined()
    onEnterLobby(code)
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
          className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white active:scale-95 disabled:opacity-60"
        >
          参加する
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <BackButton onBack={onBack} label="戻る" />
      <h1 className="text-2xl font-black tracking-widest text-white">🚪 PRIVATE ROOM</h1>
      <p className="text-xs text-white/40">友達だけのロビーを作って、何度でも対戦できます</p>
      {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
      <div className="flex w-full max-w-xs flex-col gap-4">
        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white active:scale-95 disabled:opacity-60"
        >
          {hasPass ? 'ルームを作る' : '🔒 ルームを作る（DOPA PASS限定）'}
        </button>
        <button
          onClick={() => setView('join_input')}
          className="w-full rounded-2xl border border-white/15 bg-white/5 py-4 text-base font-black tracking-widest text-white/85 active:scale-95"
        >
          ルームに入る
        </button>
        <p className="text-[11px] text-white/40">参加はどなたでも無料です</p>
      </div>
    </div>
  )
}
