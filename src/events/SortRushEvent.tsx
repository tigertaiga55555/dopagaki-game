import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { V3_CONFIG } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { shuffle } from '../engine/random'
import { BonusInterrupt, type BonusInterruptResult } from './BonusInterrupt'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { DiagnosticOutcome, EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.sortRush

const FOODS = ['🍎', '🍔', '🍣', '🍩', '🍕', '🍇']
const NON_FOODS = ['🚗', '⚽', '📱', '🎸', '✏️', '🪑']

function buildCards() {
  const foodCount = Math.ceil(CFG.cardCount / 2)
  const cards = [
    ...shuffle(FOODS).slice(0, foodCount).map((emoji) => ({ emoji, isFood: true })),
    ...shuffle(NON_FOODS)
      .slice(0, CFG.cardCount - foodCount)
      .map((emoji) => ({ emoji, isFood: false })),
  ]
  return shuffle(cards)
}

function Content({ onComplete }: EventComponentProps) {
  const cardsRef = useRef(buildCards())
  const [cardIndex, setCardIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [combo, setCombo] = useState(0)
  const [interruptEnabled, setInterruptEnabled] = useState(false)

  const cardShownAtRef = useRef(performance.now())
  const dragStartXRef = useRef<number | null>(null)
  const scoreDeltaRef = useRef(0)
  const missCountRef = useRef(0)
  const decisionTimesRef = useRef<number[]>([])
  const doneRef = useRef(false)
  const comboRef = useRef(0)
  const pausedRef = useRef(false)
  const pauseStartRef = useRef<number | null>(null)
  const cardPausedMsRef = useRef(0)
  const cardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardTimerRemainingRef = useRef(CFG.perCardTimeoutMs)
  const cardTimerStartRef = useRef(0)
  const ignoredDiagnosticsRef = useRef<DiagnosticOutcome[]>([])

  function scheduleCardTimeout(ms: number) {
    cardTimerStartRef.current = performance.now()
    cardTimerRemainingRef.current = ms
    cardTimerRef.current = setTimeout(() => resolveCard(null), ms)
  }

  function pauseCardTimeout() {
    if (cardTimerRef.current) {
      clearTimeout(cardTimerRef.current)
      const elapsed = performance.now() - cardTimerStartRef.current
      cardTimerRemainingRef.current = Math.max(0, cardTimerRemainingRef.current - elapsed)
      cardTimerRef.current = null
    }
  }

  useEffect(() => {
    cardShownAtRef.current = performance.now()
    cardPausedMsRef.current = 0
    scheduleCardTimeout(CFG.perCardTimeoutMs)
    return () => {
      if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex])

  function resolveCard(direction: 'left' | 'right' | null) {
    if (doneRef.current || pausedRef.current) return
    const card = cardsRef.current[cardIndex]
    const decisionMs = performance.now() - cardShownAtRef.current - cardPausedMsRef.current
    decisionTimesRef.current.push(decisionMs)

    const chosenFood = direction === 'right'
    const correct = direction !== null && chosenFood === card.isFood

    if (correct) {
      comboRef.current += 1
      scoreDeltaRef.current += CFG.correctReward + (comboRef.current - 1) * CFG.comboBonusPerStreak
    } else {
      comboRef.current = 0
      if (direction !== null) scoreDeltaRef.current += CFG.incorrectPenalty
      missCountRef.current += 1
    }
    setCombo(comboRef.current)
    if (!interruptEnabled && comboRef.current >= CFG.comboInterruptEligibleAt) {
      setInterruptEnabled(true)
    }

    setDragX(0)
    if (cardIndex + 1 >= cardsRef.current.length) {
      finish()
    } else {
      setCardIndex((i) => i + 1)
    }
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    const times = decisionTimesRef.current
    const avgMs = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)
    const misses = missCountRef.current

    let score: number
    if (avgMs <= CFG.fastMsThreshold) score = 65
    else if (avgMs <= CFG.moderateMsThreshold) score = 40
    else score = 15
    if (misses >= 2) score = Math.min(100, score + 25)
    else if (misses === 1) score = Math.min(100, score + 10)

    onComplete({
      eventId: 'sortRush',
      scoreDelta: scoreDeltaRef.current,
      diagnostics: [
        ...ignoredDiagnosticsRef.current,
        {
          category: 'stimulation',
          score,
          crimeText:
            score >= V3_CONFIG.crimeThreshold
              ? `カードを平均${(avgMs / 1000).toFixed(1)}秒でめくり${misses}回ミス`
              : undefined,
        },
      ],
    })
  }

  function handleInterruptVisibility(visible: boolean) {
    pausedRef.current = visible
    if (visible) {
      pauseStartRef.current = performance.now()
      pauseCardTimeout()
    } else {
      if (pauseStartRef.current !== null) {
        cardPausedMsRef.current += performance.now() - pauseStartRef.current
        pauseStartRef.current = null
      }
      scheduleCardTimeout(cardTimerRemainingRef.current)
    }
  }

  function handleInterruptResolved(result: BonusInterruptResult) {
    if (!result.accepted) {
      ignoredDiagnosticsRef.current = [...ignoredDiagnosticsRef.current, ...result.diagnostics]
      return
    }
    if (doneRef.current) return
    doneRef.current = true
    if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
    comboRef.current = 0
    onComplete({
      eventId: 'sortRush',
      scoreDelta: scoreDeltaRef.current + result.scoreDelta,
      diagnostics: result.diagnostics,
    })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (pausedRef.current) return
    dragStartXRef.current = e.clientX
  }
  function handlePointerMove(e: ReactPointerEvent) {
    if (pausedRef.current || dragStartXRef.current === null) return
    setDragX(e.clientX - dragStartXRef.current)
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (pausedRef.current || dragStartXRef.current === null) return
    const delta = e.clientX - dragStartXRef.current
    dragStartXRef.current = null
    if (Math.abs(delta) > 60) {
      resolveCard(delta > 0 ? 'right' : 'left')
    } else {
      setDragX(0)
    }
  }

  const card = cardsRef.current[cardIndex]

  return (
    <div className="relative">
      <BonusInterrupt
        enabled={interruptEnabled}
        getStakeLabel={() => `COMBO×${comboRef.current}`}
        getStakeScore01={() => Math.min(1, comboRef.current / 6)}
        onVisibilityChange={handleInterruptVisibility}
        onResolved={handleInterruptResolved}
      />
      <EventShell>
        <p className="text-xs font-bold text-white/40">食べ物→右 ／ それ以外→左</p>
        {combo >= 2 && <p className="text-sm font-black text-amber-300">COMBO ×{combo}</p>}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)` }}
          className="flex h-40 w-40 touch-none select-none items-center justify-center rounded-3xl bg-white/10 text-7xl transition-transform"
        >
          {card.emoji}
        </div>
        <p className="text-xs text-white/30">
          {cardIndex + 1} / {cardsRef.current.length}
        </p>
      </EventShell>
    </div>
  )
}

export function SortRushEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.sortRush}>
      <Content {...props} />
    </EventIntro>
  )
}
