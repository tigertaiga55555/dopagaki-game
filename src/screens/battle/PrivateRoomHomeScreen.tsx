import { useEffect, useState } from 'react'
import { NavBar } from '../../components/NavBar'
import { createPrivateRoom, getActiveRoomForPlayer, getPrivateRoomStatus } from '../../battle/privateRoomClient'
import { normalizeRoomCode, isValidRoomCode } from '../../battle/roomCode'
import { trackPrivateRoomJoined } from '../../utils/analytics'
import type { BattleOpponentProfile } from '../../battle/types'

interface Props {
  onBack: () => void
  onHome: () => void
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

type View = 'checking' | 'menu' | 'join_input' | 'returning'

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15 PRIVATE ROOM → FRIENDS/TABLE/ナビ追加調整
 * ラウンド、item 42/46-47で改修）: 「友達と対戦」を作る/入る画面。
 *
 * item 42: ユーザー向け文言から"PRIVATE ROOM"を排除した（内部のファイル名・データモデル
 * としては引き続き使う）。
 *
 * item 46-47: 画面を開いた瞬間、まず「今まさに参加中/作成中のルームがあるか」を
 * サーバーへ問い合わせる（player_idキーのmembership、クライアント側のstateだけに頼らない）。
 * あれば、新規作成/参加の案より優先して「参加中のルームに戻る」（自分がホストなら
 * 「作成中のルームに戻る」）を表示する——ホームへ戻る・アプリをバックグラウンドにする・
 * 一時的な接続断のいずれも「退出」として扱わないため、この優先導線が常に機能する。
 * ただし/room/:roomCodeを直接開いた場合（initialRoomCode指定時）は、そのURLの意図を
 * 優先してjoin_inputへ直行する（既存の挙動を変えない）。
 */
export function PrivateRoomHomeScreen({ onBack, onHome, onEnterLobby, onRequirePass, hasPass, playerId, myProfile, initialRoomCode }: Props) {
  const [view, setView] = useState<View>(initialRoomCode ? 'join_input' : 'checking')
  const [activeRoom, setActiveRoom] = useState<{ roomCode: string; isHost: boolean } | null>(null)
  const [codeInput, setCodeInput] = useState(initialRoomCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initialRoomCode) return
    getActiveRoomForPlayer(playerId).then((active) => {
      setActiveRoom(active)
      setView(active ? 'returning' : 'menu')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (view === 'checking') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <NavBar onBack={onBack} onHome={onHome} />
        <p className="text-sm font-bold text-white/50">確認しています…</p>
      </div>
    )
  }

  if (view === 'returning' && activeRoom) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <NavBar onBack={onBack} onHome={onHome} />
        <h1 className="text-2xl font-black tracking-widest text-white">🤝 友達と対戦</h1>
        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={() => onEnterLobby(activeRoom.roomCode)}
            className="w-full rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white active:scale-95"
          >
            {activeRoom.isHost ? '作成中のルームに戻る' : '参加中のルームに戻る'}
          </button>
          <p className="text-[11px] text-white/40">
            ホームに戻ったり、アプリを閉じたりしても参加状態は保たれます。
          </p>
          <button
            onClick={() => setView('menu')}
            className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 active:scale-95"
          >
            別のルームを作る／入る
          </button>
        </div>
      </div>
    )
  }

  if (view === 'join_input') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <NavBar onBack={onBack} onHome={onHome} />
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
      <NavBar onBack={onBack} onHome={onHome} />
      <h1 className="text-2xl font-black tracking-widest text-white">🤝 友達と対戦</h1>
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
