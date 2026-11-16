import { useEffect, useRef, useState } from 'react'
import { resolveAvatarEmoji } from '../../config/profileConfig'
import { connectToBattleRoom, type BattleSocket } from '../../battle/battleClient'
import { buildBattleRoomUrl } from '../../battle/battleUrl'
import {
  checkBattleComebackAchievement,
  checkBattleDecidingStatAchievement,
  checkBattleMirrorAchievement,
  checkFriendBattleFirstPlayAchievement,
  checkFriendBattlePlayAchievements,
  checkGrindAchievements,
  checkWorldBattleFirstDrawAchievement,
  checkWorldBattleFirstPlayAchievement,
  checkWorldBattleStreakAchievements,
  checkWorldBattleWinAchievements,
} from '../../utils/achievementStorage'
import { incrementFriendBattlePlayCount, recordWorldBattleOutcome } from '../../utils/battleStatsStorage'
import { getOfficialPlayCount, incrementOfficialPlayCount } from '../../utils/storage'
import { PlayScreen } from '../PlayScreen'
import { BattleResultScreen } from './BattleResultScreen'
import { trackBattleDisconnect, trackBattleForfeit, trackBattleMatchEnd, trackBattleMatchStart } from '../../utils/analytics'
import type { BattleFinishResult, BattleMode, BattleOpponentProfile } from '../../battle/types'
import type { AchievementId, ChallengeProblemSetItem, FinalResultV4 } from '../../types'

/**
 * Ver.6 Phase 10（実績拡張ラウンド、大逆転）: 現在取得可能な試合中データ（myPercent＝自分の
 * 現在%、opponentPercent＝直近のopponent_progressで受け取った相手の%）を調査した結果、
 * 「試合中、相手に何%差を付けられていたか」はこの2つのstateの差分として安全に計算できる
 * （どちらも既存のRIVAL% HUD表示に実際に使われている値そのもので、新しい推測値ではない）。
 * 10%・20%の両方を検討し、20%を採用した: 10%は1〜2問の反応差だけでも発生しうる頻出差で
 * あるのに対し、20%は「はっきり離されていた」と言える、テストでも誤判定しにくい閾値。
 */
const COMEBACK_DEFICIT_THRESHOLD = 20

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
  const [readyFlash, setReadyFlash] = useState(false)
  const [myPercent, setMyPercent] = useState(0)
  const [opponentPercent, setOpponentPercent] = useState(0)
  const [opponentUnstable, setOpponentUnstable] = useState(false)
  const [finishPayload, setFinishPayload] = useState<{ result: BattleFinishResult; viewerIsPlayerA: boolean } | null>(null)
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementId[]>([])

  const socketRef = useRef<BattleSocket | null>(null)
  const questionIndexRef = useRef(0)
  const lastEventAtRef = useRef(Date.now())
  const lastTrialPercentRef = useRef<number | null>(null)
  const matchStartTrackedRef = useRef(false)
  /** Ver.6 Phase 10（大逆転）: 試合中、相手に最大何%差を付けられていたか（opponentPercent-myPercentの最大値）。 */
  const maxDeficitRef = useRef(0)

  useEffect(() => {
    maxDeficitRef.current = Math.max(maxDeficitRef.current, opponentPercent - myPercent)
  }, [myPercent, opponentPercent])

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
          const myOutcome: 'win' | 'lose' | 'draw' =
            msg.result.winner === 'draw' ? 'draw' : (msg.result.winner === 'playerA') === msg.viewerIsPlayerA ? 'win' : 'lose'
          // Ver.6 Phase 10（実績拡張ラウンド）: Grind実績の公式プレイ回数は世界対戦・フレンド
          // 対戦どちらも加算する（Challenge/ENDLESS Challengeは含まない、という既存方針どおり）。
          incrementOfficialPlayCount()
          let unlocked: AchievementId[] = checkGrindAchievements(getOfficialPlayCount())
          if (mode === 'world') {
            const stats = recordWorldBattleOutcome(myOutcome)
            unlocked = [
              ...unlocked,
              ...checkWorldBattleFirstPlayAchievement(),
              ...checkWorldBattleWinAchievements(stats.wins),
              ...checkWorldBattleStreakAchievements(stats.maxStreak),
              ...(myOutcome === 'draw' ? checkWorldBattleFirstDrawAchievement() : []),
            ]
            // Ver.6 Phase 10: decidedByが実際に比較された項目（baseDopaPercent/accuracy/
            // maxCombo/medianCorrectReactionMs）で、かつその項目が決勝要因になってWINした
            // 場合のみ「ボーナスに頼らない/正確無比/連鎖の鬼/反射神経バケモノ」を解除する
            // （finalDopaPercentで既に決着していた場合はここに来ない＝誤判定しない）。
            const decidedBy = msg.result.decidedBy
            if (
              myOutcome === 'win' &&
              decidedBy &&
              (decidedBy === 'baseDopaPercent' || decidedBy === 'accuracy' || decidedBy === 'maxCombo' || decidedBy === 'medianCorrectReactionMs')
            ) {
              unlocked = [...unlocked, ...checkBattleDecidingStatAchievement(decidedBy)]
            }
            // Ver.6 Phase 10: 5項目完全一致DRAW（鏡写し）。
            if (myOutcome === 'draw' && decidedBy === 'exactTie') {
              unlocked = [...unlocked, ...checkBattleMirrorAchievement()]
            }
            // Ver.6 Phase 10: 大逆転（試合中に一定以上のビハインドから最終WIN、forfeit/disconnect等の不戦勝は対象外）。
            if (myOutcome === 'win' && msg.result.finishReason === 'completed' && maxDeficitRef.current >= COMEBACK_DEFICIT_THRESHOLD) {
              unlocked = [...unlocked, ...checkBattleComebackAchievement()]
            }
          } else {
            const friendPlays = incrementFriendBattlePlayCount()
            unlocked = [...unlocked, ...checkFriendBattleFirstPlayAchievement(), ...checkFriendBattlePlayAchievements(friendPlays)]
          }
          setNewlyUnlocked(unlocked)
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

  // item 11: サーバーが確定したstartAtだけを基準に試合開始を同期する（各端末が個別に
  // タイマーを開始する方式は禁止）。実機QAでの指摘により、Battle側では数字の
  // カウントダウン（3→2→1→START）を独自に表示しない。VS画面→READYの短い演出だけを
  // startAtの手前で見せ、startAtに達した瞬間そのままplaying（=既存PlayScreen/
  // useRushGameが内部で持つpreCountdown=3→2→1→GO）へ切り替える。両プレイヤーとも
  // 同じstartAtでこのuseEffectからsetPhase('playing')を呼ぶため、PlayScreen（＝
  // useRushGame）がマウントされる実時刻が両者で一致し、結果としてpreCountdownの
  // 3→2→1→GOも両者で揃って表示される（新しい同期機構を追加する必要がない）。
  useEffect(() => {
    if (phase !== 'countdown' || startAt === null) return
    const READY_WINDOW_MS = 1000
    const tick = () => {
      const remainingMs = startAt - Date.now()
      if (remainingMs <= 0) {
        setPhase('playing')
        if (!matchStartTrackedRef.current) {
          matchStartTrackedRef.current = true
          trackBattleMatchStart(mode)
        }
        return
      }
      setReadyFlash(remainingMs <= READY_WINDOW_MS)
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
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
        newlyUnlockedAchievements={newlyUnlocked}
      />
    )
  }

  if (phase === 'playing') {
    // item 1/2（実機QA指摘）: YOU%は既存ゲームUI中央の自分のDOPA%表示と重複するため廃止。
    // RIVAL%はQuitButton（「×やめる」）の帯の左側スロットに差し込む「専用の段」方式にし、
    // absolute overlayで上から被せていた以前の実装（やめるボタンとの重なりの原因）を排除する。
    const battleHud = (
      <div className="flex flex-col items-start gap-1">
        <div className="rounded-xl bg-black/55 px-3 py-1 text-left leading-tight">
          <p className="text-[9px] font-black tracking-widest text-rose-300/70">RIVAL</p>
          <p className="text-2xl font-black tabular-nums text-rose-300">{Math.max(0, Math.round(opponentPercent))}%</p>
        </div>
        {opponentUnstable && (
          <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-black">相手との接続が不安定です</span>
        )}
      </div>
    )
    return (
      <PlayScreen
        replayQuestions={problemSet ?? undefined}
        onQuestionResolved={handleAnswer}
        onFinalTrialProgress={handleFinalTrialProgress}
        onFinish={handleFinish}
        onQuit={handleForfeit}
        battleHud={battleHud}
        official={false}
      />
    )
  }

  if (phase === 'countdown') {
    // item 4/5/6（実機QA指摘）: Battle側では数字のカウントダウンを出さない。VS画面を維持した
    // まま、startAtの最後の約1秒だけ「READY」を短く見せ、startAtちょうどでplayingへ切り替える
    // （数字の3→2→1→STARTは、この直後にマウントされる既存PlayScreen/useRushGame自身の
    // preCountdownが1回だけ担当する）。
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-black px-6 text-center">
        <div className="flex items-center gap-8">
          <PlayerVsCard profile={myProfile} label="YOU" />
          <p className="text-2xl font-black text-rose-400">VS</p>
          <PlayerVsCard profile={opponent} label="RIVAL" />
        </div>
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
