import { useEffect, useRef, useState } from 'react'
import { randInt } from '../engine/random'
import { createResolveOnce } from '../engine/resolveOnce'
import { computeBonusGain } from '../config/scoreConfigV4'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule, QuestionResult } from '../types'

/**
 * Ver.4.8: 「連打→急停止」（RapidStop）を通常ローテーションから撤去した代わりに追加した、
 * MISSの一切ない純粋な刺激ゲーム。ドパガキの通常プレイは判定・認知・抑制の負荷が高いため、
 * ここだけは「考えるのをやめて、ただ連打の気持ちよさを感じる」小休止として設計している。
 * どれだけ叩いても・どれだけ叩かなくても失敗にはならない（correct:trueしか返さない）。
 */
const INTRO_MS = 480
const OUTRO_MS = 550
/** コンタクトバウンス対策。RepeatTapと同じ基準を流用する。 */
const MIN_TAP_INTERVAL_MS = 45

function generate() {
  return { tapWindowMs: randInt(1500, 2000) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { tapWindowMs } = data as { tapWindowMs: number }
  return INTRO_MS + tapWindowMs + OUTRO_MS
}

type Phase = 'intro' | 'tapping' | 'outro'

function Component({ spec, onResult }: QuestionComponentProps) {
  const { tapWindowMs } = spec.data as { tapWindowMs: number }
  const [phase, setPhase] = useState<Phase>('intro')
  const [hitCount, setHitCount] = useState(0)
  const phaseRef = useRef<Phase>('intro')
  const hitCountRef = useRef(0)
  const lastTapAtRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const guardRef = useRef<ReturnType<typeof createResolveOnce<QuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    const t1 = setTimeout(() => {
      phaseRef.current = 'tapping'
      setPhase('tapping')
    }, INTRO_MS)
    const t2 = setTimeout(() => {
      phaseRef.current = 'outro'
      setPhase('outro')
      sfx.bonusBoost()
      const t3 = setTimeout(() => {
        guardRef.current!.resolve({
          correct: true,
          reactionMs: 0,
          tierOverride: 'PERFECT',
          meta: { bonusTapCount: hitCountRef.current },
        })
      }, OUTRO_MS)
      timersRef.current.push(t3)
    }, INTRO_MS + tapWindowMs)
    timersRef.current.push(t1, t2)
    return () => {
      timersRef.current.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTap() {
    if (guardRef.current!.isResolved || phaseRef.current !== 'tapping') return
    const now = performance.now()
    if (now - lastTapAtRef.current < MIN_TAP_INTERVAL_MS) return
    lastTapAtRef.current = now
    const next = hitCountRef.current + 1
    hitCountRef.current = next
    setHitCount(next)
    sfx.bonusTap(next)
  }

  const bonusPercent = computeBonusGain(hitCount)

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-4 text-center select-none">
      {phase === 'intro' && (
        <p className="anim-pop text-4xl font-black text-amber-300">DOPA BONUS TIME！</p>
      )}
      {phase === 'tapping' && (
        <>
          <p className="text-3xl font-black text-amber-200">連打しろ！！！！</p>
          <button
            onPointerDown={handleTap}
            className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-orange-500 text-4xl font-black text-white shadow-[0_0_40px_rgba(251,191,36,0.6)] active:scale-95"
          >
            {hitCount}
            <span className="ml-1 text-lg">HIT</span>
          </button>
          {/*
            Ver.5.0追加修正: 新仕様「2タップで+1%、最大+10%」を、タップの度に軽い反応
            （ボタン自体のactive:scale-95＋sfx.bonusTapのピッチ変化）を出しつつ、
            実際に%が上がる2タップごとのタイミングでだけ、この表示をkey付きで
            再マウントして「anim-pop」を打ち直す（＝毎タップの小反応と、2タップごとに
            本当に数値が増える瞬間とを見た目でもはっきり区別する）。
          */}
          <p key={bonusPercent} className="anim-pop text-2xl font-black text-amber-300">
            +{bonusPercent}%
          </p>
        </>
      )}
      {phase === 'outro' && (
        <div className="anim-pop flex flex-col items-center gap-1">
          <p className="text-3xl font-black text-amber-300">{hitCount} HIT！</p>
          <p className="text-2xl font-black text-white">+{bonusPercent}% DOPA BOOST！</p>
        </div>
      )}
    </div>
  )
}

export const BonusTimeQuestionModule: QuestionModule = {
  id: 'bonusTime',
  category: 'rapid',
  baseTargetTimeMs: 2500,
  generate,
  Component,
  computeMinTargetTimeMs,
}
