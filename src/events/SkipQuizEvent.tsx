import { useEffect, useRef, useState } from 'react'
import { V3_CONFIG, scoreByElapsed } from '../config/gameConfigV3'
import { EVENT_INTROS } from '../config/messagesV3'
import { pick, shuffle } from '../engine/random'
import { EventIntro } from './EventIntro'
import { EventShell } from './EventShell'
import type { EventComponentProps } from '../types'

const CFG = V3_CONFIG.events.skipQuiz

const PASSAGES = [
  { text: '図書館の開館時間は9時、閉館は19時です。', question: '図書館は何時に閉まる？', options: ['17時', '18時', '19時', '20時'], correct: '19時' },
  { text: '倉庫には赤い箱が3個、青い箱が5個あります。', question: '箱は合計いくつ？', options: ['6個', '7個', '8個', '9個'], correct: '8個' },
  { text: '駅前のパン屋は月曜定休、朝7時開店です。', question: 'パン屋の定休日は？', options: ['日曜', '月曜', '火曜', '無休'], correct: '月曜' },
]

function Content({ onComplete }: EventComponentProps) {
  const [skipVisible, setSkipVisible] = useState(false)
  const [phase, setPhase] = useState<'reading' | 'quiz'>('reading')
  const passageRef = useRef(pick(PASSAGES))
  const optionsRef = useRef(shuffle(passageRef.current.options))
  const skipShownAtRef = useRef<number | null>(null)
  const skippedRef = useRef(false)

  useEffect(() => {
    const showTimer = setTimeout(() => {
      skipShownAtRef.current = performance.now()
      setSkipVisible(true)
    }, CFG.skipShowDelayMs)
    // SKIPしなくても、最後まで読み終わったら自動でクイズへ進む
    const autoTimer = setTimeout(() => setPhase('quiz'), CFG.readAutoAdvanceMs)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(autoTimer)
    }
  }, [])

  function handleSkip() {
    skippedRef.current = true
    setPhase('quiz')
  }

  function handleAnswer(value: string) {
    const correct = value === passageRef.current.correct
    const elapsed = skippedRef.current && skipShownAtRef.current ? performance.now() - skipShownAtRef.current : null
    const score = elapsed !== null ? scoreByElapsed(elapsed, CFG.bands, CFG.fallbackScore) : CFG.fallbackScore
    onComplete({
      eventId: 'skipQuiz',
      scoreDelta: correct ? CFG.correct : CFG.incorrect,
      diagnostic: {
        category: 'skip',
        score,
        crimeText: elapsed !== null && score >= V3_CONFIG.crimeThreshold ? `説明を${(elapsed / 1000).toFixed(1)}秒でSKIP` : undefined,
      },
    })
  }

  if (phase === 'quiz') {
    return (
      <EventShell>
        <p className="text-sm font-bold text-white/60">{passageRef.current.question}</p>
        <div className="grid grid-cols-2 gap-3">
          {optionsRef.current.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className="rounded-2xl bg-white/10 py-4 text-base font-black text-white active:bg-white/20"
            >
              {opt}
            </button>
          ))}
        </div>
      </EventShell>
    )
  }

  return (
    <EventShell>
      <p className="text-sm leading-relaxed text-white/80">{passageRef.current.text}</p>
      {skipVisible && (
        <button onClick={handleSkip} className="anim-pop rounded-full bg-white/10 px-6 py-2.5 text-sm font-bold text-white/80">
          SKIP
        </button>
      )}
    </EventShell>
  )
}

export function SkipQuizEvent(props: EventComponentProps) {
  return (
    <EventIntro text={EVENT_INTROS.skipQuiz}>
      <Content {...props} />
    </EventIntro>
  )
}
