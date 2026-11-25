import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { connectToWorldQueue, type BattleSocket } from '../../battle/battleClient'
import { WORLD_BATTLE_RULESET, WORLD_BATTLE_RULESET_LABEL } from '../../config/worldBattleConfig'
import { trackBattleMatchmakingCancel, trackBattleMatchmakingStart, trackBattleMatchmakingTimeout } from '../../utils/analytics'
import { sfx } from '../../utils/sound'
import type { BattleOpponentProfile } from '../../battle/types'

interface Props {
  playerId: string
  profile: BattleOpponentProfile
  onBack: () => void
  onMatchFound: (matchId: string, opponent: BattleOpponentProfile) => void
}

type State = 'connecting' | 'matching' | 'timeout'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: 世界対戦のマッチング画面。
 * 待機時間（15秒）の判定は必ずサーバー（Matchmaker Durable Object）側で行い、
 * クライアントは単にqueue_timeoutメッセージを待つだけにする（client/server間のタイマー
 * ズレを作らない）。待機中のキャンセルは敗北扱いにしない（cancel_world_queueを送るだけ）。
 */
export function WorldMatchingScreen({ playerId, profile, onBack, onMatchFound }: Props) {
  const [state, setState] = useState<State>('connecting')
  const [retryKey, setRetryKey] = useState(0)
  const socketRef = useRef<BattleSocket | null>(null)

  useEffect(() => {
    setState('connecting')
    trackBattleMatchmakingStart()
    const socket = connectToWorldQueue(
      playerId,
      profile,
      (msg) => {
        if (msg.type === 'queue_joined') setState('matching')
        if (msg.type === 'match_found') onMatchFound(msg.matchId, msg.opponent)
        if (msg.type === 'queue_timeout') {
          trackBattleMatchmakingTimeout()
          setState('timeout')
        }
      },
      () => {},
    )
    socketRef.current = socket
    socket.send({ v: 1, type: 'join_world_queue' })
    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey])

  function handleCancel() {
    trackBattleMatchmakingCancel()
    socketRef.current?.send({ v: 1, type: 'cancel_world_queue' })
    onBack()
  }

  if (state === 'timeout') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-base font-bold text-white/70">対戦相手が見つかりませんでした</p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onClick={() => {
              sfx.uiTap()
              setRetryKey((k) => k + 1)
            }}
            className="w-full rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 py-4 text-base font-black tracking-widest text-white active:scale-95"
          >
            もう一度探す
          </button>
          <button
            onClick={() => {
              sfx.navBack()
              onBack()
            }}
            className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white active:scale-95"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <BackButton onBack={handleCancel} label="キャンセル" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-rose-400/60 border-t-transparent" />
        <p className="text-lg font-black tracking-widest text-white/90">
          {state === 'connecting' ? '接続中…' : 'MATCHING...'}
        </p>
        <p className="text-xs text-white/40">対戦相手を探しています</p>
        {/* 次フェーズ（item 81）: 世界対戦はNORMAL（DOPA RUSH）ルール専用であることを小さく明示する（将来WORLD ENDLESS追加時に備え、文字列はconfig/worldBattleConfig.tsの1箇所から引く）。 */}
        <p className="text-[10px] font-bold tracking-widest text-white/25">{WORLD_BATTLE_RULESET_LABEL[WORLD_BATTLE_RULESET]}</p>
      </div>
    </div>
  )
}
