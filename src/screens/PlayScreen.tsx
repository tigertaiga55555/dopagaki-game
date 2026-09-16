import { useEffect, useRef, useState } from 'react'
import {
  getOverdriveFrameClass,
  getOverdriveTier,
  Golden120Overlay,
  LimitErrorOverlay,
  OverdriveAmbience,
  OverdriveRevealOverlay,
  WhiteFlashOverlay,
} from '../components/OverdriveFx'
import { getVisualLevelDef } from '../config/visualConfig'
import { MILESTONE_TEXT } from '../config/messagesV4'
import { OVERDRIVE_CONFIG } from '../config/overdriveConfig'
import { getOverdriveTitle } from '../config/resultTypesV4'
import { useRushGame, type RushFinishPayload } from '../engine/useRushGame'
import { QUESTION_MODULES } from '../questions'
import { isMuted, setMuted } from '../utils/sound'

interface Props {
  onFinish: (payload: RushFinishPayload) => void
}

const JUDGEMENT_COLOR: Record<string, string> = {
  PERFECT: 'text-amber-300',
  GREAT: 'text-emerald-400',
  GOOD: 'text-sky-400',
  MISS: 'text-red-400',
}

const PARTICLE_POSITIONS = Array.from({ length: 8 }).map((_, i) => ({ x: (i * 12.5) % 100, delay: i * 0.2 }))

export function PlayScreen({ onFinish }: Props) {
  const { snapshot, handleQuestionResult } = useRushGame(onFinish)
  const [muted, setMutedState] = useState(isMuted())
  const shakeWrapperRef = useRef<HTMLDivElement>(null)

  const visual = getVisualLevelDef(snapshot.visualLevel)
  const CurrentQuestion = snapshot.currentSpec ? QUESTION_MODULES[snapshot.currentSpec.type].Component : null
  const isMiss = snapshot.lastJudgement === 'MISS'
  const blinkMs = snapshot.remainingSec > 6 ? 900 : snapshot.remainingSec > 3 ? 450 : 220

  /**
   * Ver.4.8: 最重要バグの根本原因だった箇所。以前はこのシェイク演出を「keyを変えて
   * 要素ごと作り直す」方式で再生していたため、MISS表示が消える瞬間（約380ms後）に
   * 出題エリア全体（CurrentQuestionを含む）が一度アンマウント→再マウントされていた。
   * これにより、直前の問題がMISSした直後に出た新しい問題を触り始めたプレイヤーの
   * 入力途中の状態（RepeatTapのカウント・phaseなど）が丸ごと消え、正しく操作していても
   * 内部状態がリセットされてMISS扱いになる、という「操作は正しいのにMISSになる」不具合の
   * 温床になっていた。CurrentQuestionのマウント安定性（key=instanceId）とは別に、
   * シェイクの再生だけをDOM操作（reflow強制によるCSSアニメーションの再始動）で行うことで、
   * 出題コンポーネントを一切アンマウントせずに済むようにする。
   */
  useEffect(() => {
    if (!isMiss || !shakeWrapperRef.current) return
    const el = shakeWrapperRef.current
    el.classList.remove('anim-shake-fast')
    void el.offsetWidth
    el.classList.add('anim-shake-fast')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.judgementKey, isMiss])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const overdriveTier = getOverdriveTier(snapshot.displayPercent)

  const frameClass = `${
    visual.intense
      ? 'intense-frame'
      : visual.gold
        ? 'gold-frame'
        : visual.neon
          ? 'neon-frame'
          : visual.glow
            ? 'glow-frame'
            : ''
  } ${getOverdriveFrameClass(overdriveTier)}`.trim()

  return (
    <div className={`relative flex min-h-dvh flex-col overflow-hidden ${frameClass}`}>
      {visual.particles && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARTICLE_POSITIONS.map((p, i) => (
            <span
              key={i}
              className="anim-particle absolute text-base"
              style={{ left: `${p.x}%`, bottom: '8%', animationDelay: `${p.delay}s`, color: visual.gold ? '#facc15' : '#e879f9' }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      <OverdriveAmbience tier={overdriveTier} />

      {snapshot.finalRushActive && (
        <>
          <div
            className="anim-final-blink pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-red-500"
            style={{ animationDuration: `${blinkMs}ms` }}
          />
          <div
            className="anim-final-blink pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-red-500"
            style={{ animationDuration: `${blinkMs}ms` }}
          />
        </>
      )}

      {isMiss && (
        <div key={`flash-${snapshot.judgementKey}`} className="flash-red-overlay pointer-events-none fixed inset-0 z-20" />
      )}
      {snapshot.comboBreakBig && (
        <div key={`flash-dark-${snapshot.judgementKey}`} className="flash-dark-overlay pointer-events-none fixed inset-0 z-20" />
      )}
      {snapshot.showGoFlash && <div className="flash-green-overlay pointer-events-none fixed inset-0 z-20" />}

      <div className="relative z-30 flex items-start justify-between px-5 pt-3 pb-1">
        <button onClick={toggleMute} className="text-lg opacity-70" aria-label="ミュート切り替え">
          {muted ? '🔇' : '🔊'}
        </button>
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold tracking-widest text-white/50">DOPAGAKI</p>
          <p
            className={`text-4xl font-black tabular-nums ${snapshot.displayPercent >= 100 ? 'text-amber-300' : 'text-white'} ${
              snapshot.showLimitErrorGlitch ? 'anim-limit-shake' : ''
            }`}
          >
            {snapshot.displayPercent.toFixed(0)}
            <span className="text-xl">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">TIME</p>
          {snapshot.countdownValue !== null ? (
            <p
              key={snapshot.countdownValue}
              className="anim-pop text-3xl font-black tabular-nums text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]"
            >
              {snapshot.countdownValue}
            </p>
          ) : (
            <p className="text-xl font-black tabular-nums text-white">{Math.max(0, snapshot.remainingSec).toFixed(1)}</p>
          )}
        </div>
      </div>

      {snapshot.finalRushActive && (
        <div className="relative z-30 mx-4 mb-1 flex items-center justify-center gap-2 rounded-full bg-red-950/70 py-1 pointer-events-none">
          <span className="text-xs">🚨</span>
          <p className="text-[11px] font-black tracking-widest text-red-300">
            {MILESTONE_TEXT.finalRush} ・残り{Math.max(0, Math.ceil(snapshot.remainingSec))}秒
          </p>
          <span className="text-xs">🚨</span>
        </div>
      )}

      <div className="relative z-30 flex h-8 items-center justify-center">
        {snapshot.combo >= 5 ? (
          <p key={`fire-${snapshot.combo}`} className="anim-pop text-lg font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]">
            🔥 {snapshot.combo}問連続正解中！
          </p>
        ) : (
          snapshot.combo >= 2 && (
            <p key={`combo-${snapshot.combo}`} className="anim-pop text-sm font-black text-amber-200/80">
              {snapshot.combo}問連続
            </p>
          )
        )}
        {snapshot.comboMilestoneLabel && (
          <p
            key={snapshot.comboMilestoneKey}
            className="anim-pop absolute text-xl font-black text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
          >
            {snapshot.comboMilestoneLabel}
          </p>
        )}
      </div>

      <div
        ref={shakeWrapperRef}
        className="relative z-10 flex flex-1 items-center justify-center"
      >
        {snapshot.preCountdown !== null ? (
          <p key={snapshot.preCountdown} className="anim-pop text-8xl font-black text-white">
            {snapshot.preCountdown}
          </p>
        ) : (
          <>
            {CurrentQuestion && snapshot.currentSpec && (
              <div key={snapshot.currentSpec.instanceId} className="h-full w-full">
                <CurrentQuestion spec={snapshot.currentSpec} visualLevel={snapshot.visualLevel} onResult={handleQuestionResult} />
              </div>
            )}
            {snapshot.lastJudgement && (
              <div
                key={snapshot.judgementKey}
                className="anim-judgement pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1"
              >
                {snapshot.lastJudgement === 'PERFECT' && (
                  <div className="anim-gold-burst pointer-events-none absolute h-40 w-40 rounded-full bg-amber-300/60 blur-2xl" />
                )}
                <p
                  className={`relative text-5xl font-black drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${JUDGEMENT_COLOR[snapshot.lastJudgement]}`}
                >
                  {snapshot.lastJudgement}
                </p>
                {snapshot.comboBrokenFrom >= 2 && (
                  <p className="relative text-sm font-black text-red-300">
                    {snapshot.comboBreakBig ? `${snapshot.comboBrokenFrom}問連続で終了` : 'COMBO BREAK'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {snapshot.showHundredBurst && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75">
          <div className="anim-gold-burst absolute h-64 w-64 rounded-full bg-amber-300 blur-3xl" />
          <p className="relative whitespace-pre-line text-center text-5xl font-black leading-tight text-amber-300">
            {MILESTONE_TEXT.hundredPercent}
          </p>
          <p className="relative text-lg font-bold text-white">{MILESTONE_TEXT.hundredPercentSub}</p>
        </div>
      )}

      <LimitErrorOverlay show={snapshot.showLimitErrorGlitch} />
      <OverdriveRevealOverlay show={snapshot.showOverdriveBurst} showTimeBonus />
      <WhiteFlashOverlay show={snapshot.showMaxFlash} />
      <Golden120Overlay show={snapshot.showMaxBurst} title={getOverdriveTitle(OVERDRIVE_CONFIG.maxPercent).name} />
    </div>
  )
}
