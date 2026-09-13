import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { randFloat } from '../engine/random'
import type { DiagnosticOutcome } from '../types'

const CFG = V3_CONFIG.bonusInterrupt

export interface BonusInterruptResult {
  accepted: boolean
  scoreDelta: number
  diagnostics: DiagnosticOutcome[]
}

interface Props {
  /** ホスト側が「乱入ボーナスを出してよい状態」になったらtrueにする（例：コンボが2以上など） */
  enabled: boolean
  /** 乗り換えた場合に何を手放すかのラベル（例: "COMBO×5"） */
  getStakeLabel: () => string
  /** 手放す量を0〜1で正規化した値（大きいほど「大きいものを手放した」演出・診断になる） */
  getStakeScore01: () => number
  /** バナー表示中〜チャレンジ中はtrue。ホスト側は自分の進行を一時停止する */
  onVisibilityChange: (visible: boolean) => void
  onResolved: (result: BonusInterruptResult) => void
}

type Phase = 'idle' | 'offer' | 'challenge'

/** チャレンジ本体：動くマーカーを中央ゾーンでSTOPできれば成功 */
function StopGaugeChallenge({ onDone }: { onDone: (success: boolean) => void }) {
  const [pos, setPos] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const start = performance.now()
    const periodMs = 550
    let raf: number
    const tick = () => {
      const t = (performance.now() - start) % (periodMs * 2)
      const p = t < periodMs ? (t / periodMs) * 100 : 100 - ((t - periodMs) / periodMs) * 100
      setPos(p)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const timeout = setTimeout(() => finish(false), CFG.challengeMs)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(success: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onDone(success)
  }

  return (
    <div className="w-full max-w-xs" onPointerDown={() => finish(pos >= 34 && pos <= 66)}>
      <p className="mb-3 text-sm font-black text-white">中央でSTOP！</p>
      <div className="relative h-7 w-full rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-[34%] right-[34%] rounded-full bg-emerald-400/40" />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `calc(${pos}% - 10px)` }}
        />
      </div>
    </div>
  )
}

export function BonusInterrupt({ enabled, getStakeLabel, getStakeScore01, onVisibilityChange, onResolved }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(CFG.decisionWindowMs / 1000))
  const armedRef = useRef(false)
  const offerShownAtRef = useRef(0)
  const stakeRef = useRef({ label: '', score01: 0 })

  useEffect(() => {
    if (!enabled || armedRef.current) return
    armedRef.current = true
    if (Math.random() > CFG.triggerChance) return

    const delay = randFloat(CFG.armDelayMinMs, CFG.armDelayMaxMs)
    const timer = setTimeout(() => {
      stakeRef.current = { label: getStakeLabel(), score01: getStakeScore01() }
      offerShownAtRef.current = performance.now()
      onVisibilityChange(true)
      setPhase('offer')
    }, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    if (phase !== 'offer') return
    setSecondsLeft(Math.ceil(CFG.decisionWindowMs / 1000))
    const tickTimer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    const expireTimer = setTimeout(() => {
      onVisibilityChange(false)
      onResolved({
        accepted: false,
        scoreDelta: 0,
        diagnostics: [{ category: 'notification', score: CFG.ignoredScore }],
      })
    }, CFG.decisionWindowMs)
    return () => {
      clearInterval(tickTimer)
      clearTimeout(expireTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function handleAccept() {
    if (phase !== 'offer') return
    setPhase('challenge')
  }

  function handleChallengeDone(success: boolean) {
    const elapsedMs = performance.now() - offerShownAtRef.current
    const { label, score01 } = stakeRef.current
    const baseScore = scoreByElapsed(elapsedMs, CFG.bands, CFG.fallbackScore)
    const score = Math.min(100, Math.round(baseScore + score01 * CFG.stakeScoreBonusMax))
    const reactSec = (elapsedMs / 1000).toFixed(1)
    let crimeText: string | undefined
    if (score >= V3_CONFIG.crimeThreshold) {
      crimeText = score01 >= CFG.lowStakeThreshold ? `${label}を手放して${reactSec}秒でBONUSへ` : `＋${CFG.reward}の誘惑に即乗り換え`
    }

    onVisibilityChange(false)
    onResolved({
      accepted: true,
      scoreDelta: success ? CFG.reward : CFG.failReward,
      diagnostics: [{ category: 'notification', score, crimeText }],
    })
  }

  if (phase === 'offer') {
    return (
      <button
        onClick={handleAccept}
        className="anim-pop absolute inset-x-4 top-16 z-30 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 p-3 text-left shadow-xl"
      >
        <p className="text-[10px] font-black text-black/60">{secondsLeft}秒限定</p>
        <p className="text-sm font-black text-black">BONUS CHALLENGE 最大+{CFG.reward}</p>
        <p className="text-[10px] font-bold text-black/60">今だけ出現（{stakeRef.current.label}を手放す）</p>
      </button>
    )
  }

  if (phase === 'challenge') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 px-6">
        <StopGaugeChallenge onDone={handleChallengeDone} />
      </div>
    )
  }

  return null
}
