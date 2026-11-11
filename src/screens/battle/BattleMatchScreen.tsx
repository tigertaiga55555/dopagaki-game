import { useEffect, useRef, useState } from 'react'
import { resolveAvatarEmoji } from '../../config/profileConfig'
import { connectToBattleRoom, type BattleSocket } from '../../battle/battleClient'
import { buildBattleRoomUrl } from '../../battle/battleUrl'
import { recordWorldBattleOutcome } from '../../utils/battleStatsStorage'
import { PlayScreen } from '../PlayScreen'
import { BattleResultScreen } from './BattleResultScreen'
import { trackBattleDisconnect, trackBattleForfeit, trackBattleMatchEnd, trackBattleMatchStart } from '../../utils/analytics'
import type { BattleFinishResult, BattleMode, BattleOpponentProfile } from '../../battle/types'
import type { ChallengeProblemSetItem, FinalResultV4 } from '../../types'

interface Props {
  matchId: string
  mode: BattleMode
  roomCode: string | null
  playerId: string
  myProfile: BattleOpponentProfile
  initialOpponent: BattleOpponentProfile | null
  onExit: () => void
}

type Phase = 'connecting' | 'lobby' | 'countdown' | 'playing' | 'result'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: 1試合（世界対戦・フレンド対戦共通）の
 * リアルタイム進行を統括する画面。countdown→playing→resultは1本のWebSocket接続を
 * 維持したまま遷移する（Hibernatable WebSocketの設計に合わせ、接続を張り直さない）。
 *
 * 既存のPlayScreen（0〜200%、内部でFinalTrialScreenへ自動引き継ぎ）をそのまま再利用し、
 * Battle専用の別エンジンは作らない。onQuestionResolved/onFinalTrialProgressという
 * 既存コンポーネントへの追加フック経由で、1問ごとのanswerイベントをサーバーへ送る。
 */
export function BattleMatchScreen({ matchId, mode, roomCode, playerId, myProfile, initialOpponent, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [opponent, setOpponent] = useState<BattleOpponentProfile | null>(initialOpponent)
  const [iAmReady, setIAmReady] = useState(mode === 'world')
  const [problemSet, setProblemSet] = useState<ChallengeProblemSetItem[] | null>(null)
  const [startAt, setStartAt] = useState<number | null>(null)
  const [countdownLabel, setCountdownLabel] = useState('3')
  const [myPercent, setMyPercent] = useState(0)
  const [opponentPercent, setOpponentPercent] = useState(0)
  const [opponentUnstable, setOpponentUnstable] = useState(false)
  const [finishPayload, setFinishPayload] = useState<{ result: BattleFinishResult; viewerIsPlayerA: boolean } | null>(null)

  const socketRef = useRef<BattleSocket | null>(null)
  const questionIndexRef = useRef(0)
  const lastEventAtRef = useRef(Date.now())
  const lastTrialPercentRef = useRef<number | null>(null)
  const matchStartTrackedRef = useRef(false)

  useEffect(() => {
    const socket = connectToBattleRoom(
      matchId,
      playerId,
      myProfile,
      (msg) => {
        if (msg.type === 'opponent_joined') {
          setOpponent(msg.opponent)
          setPhase('lobby')
        } else if (msg.type === 'opponent_reconnected') {
          setOpponentUnstable(false)
        } else if (msg.type === 'countdown') {
          setProblemSet(msg.problemSet)
          setStartAt(msg.startAt)
          setOpponent(msg.opponent)
          setPhase('countdown')
        } else if (msg.type === 'opponent_progress') {
          setOpponentPercent(msg.percent)
        } else if (msg.type === 'opponent_disconnected') {
          setOpponentUnstable(true)
          trackBattleDisconnect()
        } else if (msg.type === 'battle_finish') {
          trackBattleMatchEnd(mode, msg.result.finishReason)
          if (mode === 'world') {
            const myOutcome =
              msg.result.winner === 'draw' ? 'draw' : (msg.result.winner === 'playerA') === msg.viewerIsPlayerA ? 'win' : 'lose'
            recordWorldBattleOutcome(myOutcome)
          }
          setFinishPayload({ result: msg.result, viewerIsPlayerA: msg.viewerIsPlayerA })
          setPhase('result')
        }
      },
      () => {},
    )
    socketRef.current = socket
    if (mode === 'world') socket.send({ v: 1, type: 'ready' })
    setPhase((p) => (p === 'connecting' ? 'lobby' : p))
    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  // item 11: サーバーが確定したstartAtだけを基準に3→2→1→STARTを表示する
  // （各端末が個別にタイマーを開始する方式は禁止）。
  useEffect(() => {
    if (phase !== 'countdown' || startAt === null) return
    let startTimer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      const remainingMs = startAt - Date.now()
      if (remainingMs <= 0) {
        // 「START」の表示自体を一瞬で消してしまわないよう、countdownLabelを'0'
        // （→START表示）にしたあと、少し見せてからplayingへ遷移する。
        setCountdownLabel('0')
        if (startTimer === null) {
          startTimer = setTimeout(() => {
            setPhase('playing')
            if (!matchStartTrackedRef.current) {
              matchStartTrackedRef.current = true
              trackBattleMatchStart(mode)
            }
          }, 500)
        }
        return
      }
      setCountdownLabel(String(Math.min(3, Math.ceil(remainingMs / 1000))))
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => {
      clearInterval(interval)
      if (startTimer !== null) clearTimeout(startTimer)
    }
  }, [phase, startAt, mode])

  function sendReady() {
    setIAmReady(true)
    socketRef.current?.send({ v: 1, type: 'ready' })
  }

  function handleAnswer(info: { correct: boolean; reactionMs: number; scoreDelta: number; bonusGainDelta: number }) {
    const questionIndex = questionIndexRef.current
    questionIndexRef.current += 1
    const nextPercent = myPercent + info.scoreDelta + info.bonusGainDelta
    setMyPercent(nextPercent)
    lastEventAtRef.current = Date.now()
    if (!problemSet || questionIndex >= problemSet.length) return
    socketRef.current?.send({ v: 1, type: 'answer', questionIndex, ...info })
    socketRef.current?.send({ v: 1, type: 'progress', percent: Math.round(nextPercent) })
  }

  function handleFinalTrialProgress(percent: number) {
    if (lastTrialPercentRef.current === null) lastTrialPercentRef.current = percent
    const questionIndex = questionIndexRef.current
    questionIndexRef.current += 1
    const now = Date.now()
    const reactionMs = Math.max(0, now - lastEventAtRef.current)
    const scoreDelta = percent - lastTrialPercentRef.current
    lastTrialPercentRef.current = percent
    lastEventAtRef.current = now
    setMyPercent(percent)
    if (!problemSet || questionIndex >= problemSet.length) return
    socketRef.current?.send({ v: 1, type: 'answer', questionIndex, correct: true, reactionMs, scoreDelta, bonusGainDelta: 0 })
    socketRef.current?.send({ v: 1, type: 'progress', percent: Math.round(percent) })
  }

  function handleFinish(result: FinalResultV4) {
    if (!result.challengePerformance) return
    socketRef.current?.send({ v: 1, type: 'finished', performance: result.challengePerformance })
  }

  function handleForfeit() {
    trackBattleForfeit()
    socketRef.current?.send({ v: 1, type: 'forfeit' })
  }

  if (phase === 'result' && finishPayload && opponent) {
    return (
      <BattleResultScreen
        result={finishPayload.result}
        viewerIsPlayerA={finishPayload.viewerIsPlayerA}
        myProfile={myProfile}
        opponent={opponent}
        onHome={onExit}
      />
    )
  }

  if (phase === 'playing') {
    return (
      <div className="relative min-h-dvh">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex items-center justify-between px-4 text-xs font-black"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2px)' }}
        >
          <span className="rounded-full bg-black/50 px-3 py-1 text-white">YOU {Math.max(0, Math.round(myPercent))}%</span>
          {opponentUnstable && <span className="rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] text-black">相手との接続が不安定です</span>}
          <span className="rounded-full bg-black/50 px-3 py-1 text-rose-300">RIVAL {Math.max(0, Math.round(opponentPercent))}%</span>
        </div>
        <PlayScreen
          replayQuestions={problemSet ?? undefined}
          onQuestionResolved={handleAnswer}
          onFinalTrialProgress={handleFinalTrialProgress}
          onFinish={handleFinish}
          onQuit={handleForfeit}
        />
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-black px-6 text-center">
        <div className="flex items-center gap-8">
          <PlayerVsCard profile={myProfile} label="YOU" />
          <p className="text-2xl font-black text-rose-400">VS</p>
          <PlayerVsCard profile={opponent} label="RIVAL" />
        </div>
        <p className="anim-pop text-7xl font-black text-white">{countdownLabel === '0' ? 'START' : countdownLabel}</p>
      </div>
    )
  }

  // 'connecting' | 'lobby'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      {mode === 'friend' && roomCode && (
        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4">
          <p className="text-[10px] font-bold tracking-widest text-white/40">ルームコード</p>
          <p className="text-3xl font-black tracking-[0.2em] text-rose-300">{roomCode}</p>
          <p className="break-all text-[10px] text-white/40">{buildBattleRoomUrl(roomCode)}</p>
        </div>
      )}
      {!opponent ? (
        <p className="text-sm font-bold text-white/60">対戦相手を待っています…</p>
      ) : (
        <>
          <PlayerVsCard profile={opponent} label="対戦相手" />
          {mode === 'friend' && !iAmReady && (
            <button
              onClick={sendReady}
              className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 py-4 text-base font-black tracking-widest text-white active:scale-95"
            >
              READY
            </button>
          )}
          {mode === 'friend' && iAmReady && <p className="text-xs font-bold text-white/40">相手のREADYを待っています…</p>}
        </>
      )}
      <button onClick={onExit} className="text-xs font-bold text-white/30">
        やめる
      </button>
    </div>
  )
}

function PlayerVsCard({ profile, label }: { profile: BattleOpponentProfile | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-400/50 bg-rose-500/10 text-3xl">
        {profile ? resolveAvatarEmoji(profile.avatar) : '❔'}
      </div>
      <p className="text-sm font-black text-white">{profile?.nickname ?? label}</p>
      <p className="text-[10px] font-bold text-white/40">{label}</p>
    </div>
  )
}
