import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByCount } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { BonusInterrupt, type BonusInterruptResult } from './BonusInterrupt'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { DiagnosticOutcome, EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.comboBoost

function Content({ onComplete }: EventComponentProps) {
  const [progress, setProgress] = useState(0)
  const [pulseKey, setPulseKey] = useState(0)
  const [interruptEnabled, setInterruptEnabled] = useState(false)

  const tapCountRef = useRef(0)
  const extraPercentRef = useRef(0)
  const accumulatedMsRef = useRef(0)
  const pausedRef = useRef(false)
  const progressRef = useRef(0)
  const doneRef = useRef(false)
  // 乱入ボーナスを無視した場合の低スコア診断。通常完了時にまとめて合流させる。
  const ignoredDiagnosticsRef = useRef<DiagnosticOutcome[]>([])

  useEffect(() => {
    let last = performance.now()
    let raf: number
    const tick = () => {
      const now = performance.now()
      const dt = now - last
      last = now
      if (!pausedRef.current) {
        accumulatedMsRef.current += dt
        const autoPercent = Math.min(100, (accumulatedMsRef.current / CFG.autoFillMs) * 100)
        const total = Math.min(100, autoPercent + extraPercentRef.current)
        progressRef.current = total
        setProgress(total)
        if (!interruptEnabled && total >= CFG.interruptEligibleAtPercent) {
          setInterruptEnabled(true)
        }
        if (total >= 100) {
          finish()
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTap() {
    if (doneRef.current || pausedRef.current) return
    tapCountRef.current += 1
    extraPercentRef.current += CFG.tapBoostPercent
    setPulseKey((k) => k + 1)
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const count = tapCountRef.current
    const score = scoreByCount(count, CFG.tapBands, CFG.fallbackScore)
    onComplete({
      eventId: 'comboBoost',
      scoreDelta: CFG.reward,
      diagnostics: [
        ...ignoredDiagnosticsRef.current,
        {
          category: 'impulse',
          score,
          crimeText: score >= V3_CONFIG.crimeThreshold ? `ゲージを${count}回連打` : undefined,
        },
      ],
    })
  }

  function handleInterruptVisibility(visible: boolean) {
    pausedRef.current = visible
  }

  function handleInterruptResolved(result: BonusInterruptResult) {
    if (!result.accepted) {
      // 無視した＝我慢できた。低スコアの診断は通常完了時に合流させ、ゲージ進行を再開する。
      ignoredDiagnosticsRef.current = [...ignoredDiagnosticsRef.current, ...result.diagnostics]
      pausedRef.current = false
      return
    }
    // 乗り換えた場合：ゲージ進捗を手放してイベント自体をここで終了する
    if (doneRef.current) return
    doneRef.current = true
    onComplete({
      eventId: 'comboBoost',
      scoreDelta: result.scoreDelta,
      diagnostics: result.diagnostics,
    })
  }

  return (
    <div onPointerDown={handleTap} className="relative cursor-pointer">
      <BonusInterrupt
        enabled={interruptEnabled}
        getStakeLabel={() => `${Math.floor(progressRef.current)}%`}
        getStakeScore01={() => progressRef.current / 100}
        onVisibilityChange={handleInterruptVisibility}
        onResolved={handleInterruptResolved}
      />
      <EventShell>
        <div key={pulseKey} className="anim-spike h-20 w-20 rounded-full bg-gradient-to-b from-fuchsia-500 to-purple-600" />
        <div className="w-full max-w-xs">
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums">{Math.floor(progress)}%</p>
        </div>
        <p className="text-xs text-white/40">タップすると少し速くなる</p>
      </EventShell>
    </div>
  )
}

export function ComboBoostEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.comboBoost}>
      <Content {...props} />
    </EventIntro>
  )
}
