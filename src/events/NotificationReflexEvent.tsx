import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { randFloat } from '../engine/random'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.notificationReflex

type Phase = 'waiting' | 'active' | 'done'

function Content({ onComplete }: EventComponentProps) {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [feedback, setFeedback] = useState<'success' | 'fail' | null>(null)
  const [notifVisible, setNotifVisible] = useState(false)

  const mainDoneRef = useRef<{ reward: number } | null>(null)
  const notifDoneRef = useRef<{ opened: boolean; bonus: number; elapsedMs: number } | null>(null)
  const notifShownAtRef = useRef<number | null>(null)
  const finalizedRef = useRef(false)

  useEffect(() => {
    const waitDuration = randFloat(CFG.waitMinMs, CFG.waitMaxMs)
    const activeTimer = setTimeout(() => setPhase('active'), waitDuration)

    const notifShowDelay = randFloat(CFG.notifShowMinMs, CFG.notifShowMaxMs)
    const notifShowTimer = setTimeout(() => {
      notifShownAtRef.current = performance.now()
      setNotifVisible(true)
    }, notifShowDelay)
    const notifHideTimer = setTimeout(
      () => {
        setNotifVisible(false)
        if (!notifDoneRef.current) {
          notifDoneRef.current = { opened: false, bonus: 0, elapsedMs: 0 }
          tryFinish()
        }
      },
      notifShowDelay + CFG.notifAutoHideMs,
    )

    return () => {
      clearTimeout(activeTimer)
      clearTimeout(notifShowTimer)
      clearTimeout(notifHideTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'active') return
    const failTimer = setTimeout(() => resolveMain(false), CFG.reactionWindowMs)
    return () => clearTimeout(failTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function resolveMain(success: boolean) {
    if (mainDoneRef.current) return
    setPhase('done')
    setFeedback(success ? 'success' : 'fail')
    mainDoneRef.current = { reward: success ? CFG.successReward : CFG.failReward }
    tryFinish()
  }

  function handleMainTap() {
    if (phase === 'waiting') {
      resolveMain(false)
    } else if (phase === 'active') {
      resolveMain(true)
    }
  }

  function handleNotifTap() {
    if (notifDoneRef.current) return
    setNotifVisible(false)
    const elapsedMs = notifShownAtRef.current ? performance.now() - notifShownAtRef.current : 0
    const win = Math.random() < CFG.notifWinChance
    notifDoneRef.current = { opened: true, bonus: win ? CFG.notifWinReward : 0, elapsedMs }
    tryFinish()
  }

  function tryFinish() {
    if (finalizedRef.current) return
    const main = mainDoneRef.current
    const notif = notifDoneRef.current
    if (!main || !notif) return
    finalizedRef.current = true

    const score = notif.opened ? scoreByElapsed(notif.elapsedMs, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'notificationReflex',
      scoreDelta: main.reward + notif.bonus,
      diagnostic: {
        category: 'notification',
        score,
        crimeText:
          notif.opened && score >= V3_CONFIG.crimeThreshold ? `BONUS通知を${(notif.elapsedMs / 1000).toFixed(1)}秒で開封` : undefined,
      },
    })
  }

  return (
    <EventShell>
      {notifVisible && (
        <button
          onClick={handleNotifTap}
          className="anim-pop absolute left-4 right-4 top-6 flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-left backdrop-blur-md"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-black">
            ?
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white">新着ボーナス</span>
            <span className="block truncate text-xs text-white/60">BONUS？</span>
          </span>
        </button>
      )}

      <button
        onClick={handleMainTap}
        disabled={phase === 'done'}
        className={`h-32 w-32 rounded-full text-sm font-bold transition-colors ${
          phase === 'active' ? 'bg-sky-400 text-black' : 'bg-white/10 text-white/40'
        }`}
      >
        {phase === 'done' ? (feedback === 'success' ? 'GOOD!' : 'MISS') : 'まだ'}
      </button>
    </EventShell>
  )
}

export function NotificationReflexEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.notificationReflex}>
      <Content {...props} />
    </EventIntro>
  )
}
