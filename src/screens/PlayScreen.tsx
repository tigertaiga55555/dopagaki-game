import { useEffect, useRef, useState } from 'react'
import { getVisualLevelDef } from '../config/visualConfig'
import { MILESTONE_TEXT } from '../config/messagesV4'
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
  const [showFinalBanner, setShowFinalBanner] = useState(false)
  const finalBannerShownRef = useRef(false)

  useEffect(() => {
    if (snapshot.finalRushActive && !finalBannerShownRef.current) {
      finalBannerShownRef.current = true
      setShowFinalBanner(true)
      const t = setTimeout(() => setShowFinalBanner(false), 1400)
      return () => clearTimeout(t)
    }
  }, [snapshot.finalRushActive])

  const visual = getVisualLevelDef(snapshot.visualLevel)
  const CurrentQuestion = snapshot.currentSpec ? QUESTION_MODULES[snapshot.currentSpec.type].Component : null
  const isMiss = snapshot.lastJudgement === 'MISS'
  const blinkMs = snapshot.remainingSec > 6 ? 900 : snapshot.remainingSec > 3 ? 450 : 220

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const frameClass = visual.intense
    ? 'intense-frame'
    : visual.gold
      ? 'gold-frame'
      : visual.neon
        ? 'neon-frame'
        : visual.glow
          ? 'glow-frame'
          : ''

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

      <div className="relative z-30 flex items-start justify-between px-5 pt-3 pb-1">
        <button onClick={toggleMute} className="text-lg opacity-70" aria-label="ミュート切り替え">
          {muted ? '🔇' : '🔊'}
        </button>
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold tracking-widest text-white/50">DOPAGAKI</p>
          <p className={`text-4xl font-black tabular-nums ${snapshot.displayPercent >= 100 ? 'text-amber-300' : 'text-white'}`}>
            {snapshot.displayPercent.toFixed(0)}
            <span className="text-xl">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest text-white/50">TIME</p>
          <p className="text-xl font-black tabular-nums text-white">{Math.max(0, snapshot.remainingSec).toFixed(1)}</p>
        </div>
      </div>

      <div className="relative z-30 h-5 text-center">
        {snapshot.combo >= 2 && <p className="anim-pop text-sm font-black text-amber-300">COMBO ×{snapshot.combo}</p>}
      </div>

      <div
        key={isMiss ? `shake-${snapshot.judgementKey}` : 'stable'}
        className={`relative z-10 flex flex-1 items-center justify-center ${isMiss ? 'anim-shake-fast' : ''}`}
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
                <p className={`text-5xl font-black drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${JUDGEMENT_COLOR[snapshot.lastJudgement]}`}>
                  {snapshot.lastJudgement}
                </p>
                {snapshot.comboBrokenFrom >= 2 && <p className="text-sm font-black text-red-300">COMBO BREAK</p>}
              </div>
            )}
          </>
        )}
      </div>

      {showFinalBanner && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-black/55">
          <p className="anim-pop whitespace-pre-line text-center text-4xl font-black text-red-400">{MILESTONE_TEXT.finalRush}</p>
          <p className="text-lg font-bold text-white">残り10秒</p>
        </div>
      )}

      {snapshot.countdownValue !== null && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <p
            key={snapshot.countdownValue}
            className="anim-pop text-9xl font-black text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]"
          >
            {snapshot.countdownValue}
          </p>
        </div>
      )}

      {snapshot.showHundredBurst && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75">
          <div className="anim-gold-burst absolute h-64 w-64 rounded-full bg-amber-300 blur-3xl" />
          <p className="relative whitespace-pre-line text-center text-5xl font-black leading-tight text-amber-300">
            {MILESTONE_TEXT.hundredPercent}
          </p>
          <p className="relative text-lg font-bold text-white">{MILESTONE_TEXT.hundredPercentSub}</p>
        </div>
      )}

      {snapshot.showOverdriveBurst && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85">
          <div className="anim-glitch absolute inset-0 bg-amber-300" />
          <p className="anim-pop relative text-4xl font-black tracking-widest text-amber-300">{MILESTONE_TEXT.overdrive}</p>
        </div>
      )}
    </div>
  )
}
