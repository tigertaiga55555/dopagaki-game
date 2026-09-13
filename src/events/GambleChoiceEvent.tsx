import { V3_CONFIG } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.gambleChoice

function Content({ onComplete }: EventComponentProps) {
  function handleSafe() {
    onComplete({
      eventId: 'gambleChoice',
      scoreDelta: CFG.safeReward,
      diagnostics: [{ category: 'impulse', score: CFG.safeScore, weight: CFG.diagnosticWeight }],
    })
  }

  function handleGamble() {
    const win = Math.random() < CFG.gambleWinChance
    onComplete({
      eventId: 'gambleChoice',
      scoreDelta: win ? CFG.gambleWinReward : CFG.gambleLoseReward,
      diagnostics: [{ category: 'impulse', score: CFG.gambleScore, weight: CFG.diagnosticWeight }],
    })
  }

  return (
    <EventShell>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button onClick={handleSafe} className="rounded-2xl bg-white/10 py-4 text-base font-bold text-white">
          確実に ＋{CFG.safeReward}
        </button>
        <button
          onClick={handleGamble}
          className="rounded-2xl bg-gradient-to-b from-fuchsia-500 to-purple-600 py-4 text-base font-black text-white"
        >
          50%で＋{CFG.gambleWinReward} / 50%で0
        </button>
      </div>
    </EventShell>
  )
}

export function GambleChoiceEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.gambleChoice}>
      <Content {...props} />
    </EventIntro>
  )
}
