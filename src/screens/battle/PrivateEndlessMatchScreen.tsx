import { useEffect, useRef, useState } from 'react'
import { resolveAvatarEmoji } from '../../config/profileConfig'
import { connectToBattleRoom, type BattleSocket } from '../../battle/battleClient'
import { EndlessPlayScreen } from '../EndlessPlayScreen'
import type { EndlessFinishPayload } from '../../engine/useEndlessGame'
import type { EndlessBattleFinishResult, BattleOpponentProfile } from '../../battle/types'
import type { ChallengeProblemSetItem, EndlessDifficulty } from '../../types'

interface Props {
  matchId: string
  endlessDifficulty: EndlessDifficulty
  playerId: string
  myProfile: BattleOpponentProfile
  initialOpponent: BattleOpponentProfile
  /** ロビーへ戻る（対戦終了後、または「やめる」操作時）。 */
  onExit: () => void
}

type Phase = 'connecting' | 'lobby' | 'countdown' | 'playing' | 'waitingOpponent' | 'result'

const DIFFICULTY_LABEL: Record<EndlessDifficulty, string> = { beginner: '初級', intermediate: '中級', advanced: '上級' }

/**
 * 次フェーズ（DOPA PASS基盤ラウンド、item 15/16 PRIVATE ROOM ENDLESS）: PRIVATE ROOMの
 * ENDLESS対戦画面。battle/battleClient.ts（既存、変更一切なし）でBattleRoom DOへ接続する
 * 点はBattleMatchScreen.tsx（NORMAL専用）と完全に同じ——異なるのは実際のプレイ中UIだけ
 * （既存PlayScreenの代わりに既存EndlessPlayScreenをqaMode+replayQuestionsで駆動する）。
 * NORMAL専用のBattleMatchScreen.tsx（achievement判定・DOPA%比較結果表示を含む、既に
 * 実績のあるコンポーネント）は一切変更しない——別の画面として新規に用意する。
 */
export function PrivateEndlessMatchScreen({ matchId, endlessDifficulty, playerId, myProfile, initialOpponent, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [opponent, setOpponent] = useState<BattleOpponentProfile>(initialOpponent)
  const [iAmReady, setIAmReady] = useState(false)
  const [problemSet, setProblemSet] = useState<ChallengeProblemSetItem[] | null>(null)
  const [startAt, setStartAt] = useState<number | null>(null)
  const [readyFlash, setReadyFlash] = useState(false)
  const [opponentStreak, setOpponentStreak] = useState(0)
  const [opponentUnstable, setOpponentUnstable] = useState(false)
  const [myFinalStreak, setMyFinalStreak] = useState<number | null>(null)
  const [finishResult, setFinishResult] = useState<{ result: EndlessBattleFinishResult; viewerIsPlayerA: boolean } | null>(null)

  const socketRef = useRef<BattleSocket | null>(null)

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
        } else if (msg.type === 'opponent_endless_progress') {
          setOpponentStreak(msg.streak)
        } else if (msg.type === 'opponent_disconnected') {
          setOpponentUnstable(true)
        } else if (msg.type === 'endless_battle_finish') {
          setFinishResult({ result: msg.result, viewerIsPlayerA: msg.viewerIsPlayerA })
          setPhase('result')
        }
      },
      () => {},
    )
    socketRef.current = socket
    setPhase((p) => (p === 'connecting' ? 'lobby' : p))
    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  useEffect(() => {
    if (phase !== 'countdown' || startAt === null) return
    const READY_WINDOW_MS = 1000
    const tick = () => {
      const remainingMs = startAt - Date.now()
      if (remainingMs <= 0) {
        setPhase('playing')
        return
      }
      setReadyFlash(remainingMs <= READY_WINDOW_MS)
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [phase, startAt])

  function sendReady() {
    setIAmReady(true)
    socketRef.current?.send({ v: 1, type: 'ready' })
  }

  function handleStreakChange(streak: number) {
    socketRef.current?.send({ v: 1, type: 'endless_progress', streak })
  }

  function handleFinish(payload: EndlessFinishPayload) {
    setMyFinalStreak(payload.score)
    socketRef.current?.send({ v: 1, type: 'endless_finished', streak: payload.score })
    setPhase('waitingOpponent')
  }

  function handleForfeit() {
    socketRef.current?.send({ v: 1, type: 'forfeit' })
  }

  if (phase === 'result' && finishResult) {
    const { result, viewerIsPlayerA } = finishResult
    const myStreak = viewerIsPlayerA ? result.playerAStreak : result.playerBStreak
    const opponentFinalStreak = viewerIsPlayerA ? result.playerBStreak : result.playerAStreak
    const outcome: 'win' | 'lose' | 'draw' =
      result.winner === 'draw' ? 'draw' : (result.winner === 'playerA') === viewerIsPlayerA ? 'win' : 'lose'
    const outcomeLabel = outcome === 'win' ? 'WIN' : outcome === 'lose' ? 'LOSE' : 'DRAW'
    const outcomeClass =
      outcome === 'win'
        ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.75)]'
        : outcome === 'lose'
          ? 'text-white/60'
          : 'text-sky-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.6)]'
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <p className="text-xs font-black tracking-[0.3em] text-white/40">ENDLESS BATTLE RESULT</p>
        <p className={`anim-pop text-5xl font-black tracking-widest ${outcomeClass}`}>{outcomeLabel}</p>
        <div className="w-full max-w-xs space-y-2 rounded-2xl bg-white/5 px-4 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/60">YOU</span>
            <span className="font-bold tabular-nums text-white">{myStreak} STREAK</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60">{opponent.nickname}</span>
            <span className="font-bold tabular-nums text-white">{opponentFinalStreak} STREAK</span>
          </div>
        </div>
        <button
          onClick={onExit}
          className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white active:scale-95"
        >
          ロビーへ戻る
        </button>
      </div>
    )
  }

  if (phase === 'waitingOpponent') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-bold text-white/60">あなたの記録</p>
        <p className="text-5xl font-black text-white">{myFinalStreak} STREAK</p>
        <p className="text-sm font-bold text-white/40">相手の結果を待っています…</p>
      </div>
    )
  }

  if (phase === 'playing' && problemSet) {
    const battleHud = (
      <div className="flex flex-col items-start gap-1">
        <div className="rounded-xl bg-black/55 px-3 py-1 text-left leading-tight">
          <p className="text-[9px] font-black tracking-widest text-rose-300/70">RIVAL STREAK</p>
          <p className="text-2xl font-black tabular-nums text-rose-300">{opponentStreak}</p>
        </div>
        {opponentUnstable && (
          <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-black">相手との接続が不安定です</span>
        )}
      </div>
    )
    return (
      <EndlessPlayScreen
        difficulty={endlessDifficulty}
        qaMode
        replayQuestions={problemSet}
        onFinish={handleFinish}
        onQuit={handleForfeit}
        battleHud={battleHud}
        onStreakChange={handleStreakChange}
      />
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-black px-6 text-center">
        <div className="flex items-center gap-8">
          <PlayerVsCard profile={myProfile} label="YOU" />
          <p className="text-2xl font-black text-fuchsia-400">VS</p>
          <PlayerVsCard profile={opponent} label="RIVAL" />
        </div>
        <p className="text-xs font-bold text-white/40">ENDLESS ・ {DIFFICULTY_LABEL[endlessDifficulty]}</p>
        <div className="flex h-16 items-center justify-center">
          <p
            className={`text-5xl font-black tracking-[0.3em] text-white transition-opacity duration-200 ${
              readyFlash ? 'opacity-100' : 'opacity-0'
            }`}
          >
            READY
          </p>
        </div>
      </div>
    )
  }

  // 'connecting' | 'lobby'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <PlayerVsCard profile={opponent} label="対戦相手" />
      {!iAmReady ? (
        <button
          onClick={sendReady}
          className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black tracking-widest text-white active:scale-95"
        >
          READY
        </button>
      ) : (
        <p className="text-xs font-bold text-white/40">相手のREADYを待っています…</p>
      )}
      <button onClick={onExit} className="text-xs font-bold text-white/30">
        やめる
      </button>
    </div>
  )
}

function PlayerVsCard({ profile, label }: { profile: BattleOpponentProfile; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-3xl">
        {resolveAvatarEmoji(profile.avatar)}
      </div>
      <p className="text-sm font-black text-white">{profile.nickname}</p>
      <p className="text-[10px] font-bold text-white/40">{label}</p>
    </div>
  )
}
