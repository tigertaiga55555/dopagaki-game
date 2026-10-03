import { useRef, useState } from 'react'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick, shuffle } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule, Challenge500Tier } from './types'

type Hand = 'rock' | 'paper' | 'scissors'
const HANDS: Hand[] = ['rock', 'paper', 'scissors']
const HAND_LABEL: Record<Hand, string> = { rock: 'グー', paper: 'パー', scissors: 'チョキ' }

/** handに勝つ手（じゃんけんの3種は常に「勝つ手」「負ける手」「同じ手」が1つずつに決まる）。 */
function winningHandAgainst(hand: Hand): Hand {
  if (hand === 'rock') return 'paper'
  if (hand === 'paper') return 'scissors'
  return 'rock'
}
function losingHandAgainst(hand: Hand): Hand {
  if (hand === 'rock') return 'scissors'
  if (hand === 'paper') return 'rock'
  return 'paper'
}

interface Panel {
  id: number
  opponent: Hand
  winLoseWordShown: string
  inverted: boolean
}

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート9（じゃんけん複合判断）。
 * FINAL/ULTIMATE由来のRPS系問題（FinalSplitRpsQuestion = 2つの対戦相手に対し独立した
 * 指示をそれぞれ満たす、FinalUltimateRpsQuadReverseQuestion等）を、winLose軸
 * （勝つ/負ける、9軸の初期候補には無いが自然な対義語として追加）と組み合わせて再利用する。
 *
 * じゃんけんは「ある手に対して勝つ手・負ける手・同じ手」が必ずそれぞれ1つに決まるため、
 * 「勝つ」「負ける」どちらの指示でも正解の手は常に一意（あいこの手は正解になり得ない）。
 *
 * ・tier1（200〜299%）：相手1人、反転候補は「勝つ/負ける」の1箇所のみ。
 * ・tier2/tier3（300〜499%）：相手2人を同時表示し、それぞれ独立に正しい手を出す必要がある
 *   （FinalSplitRpsQuestionと同じ「両方正解してはじめて成功」の多段操作）。反転候補は
 *   パネルごとに独立して最大2箇所（tier3もtier2と同じ複雑さのまま、反転の個数自体は
 *   pickInversionCountのtier3比率—反転なしを含む—に従う）。
 */
function buildPanel(id: number, invertedFlag: boolean): Panel {
  const opponent = pick(HANDS)
  const winLoseWordShown = pickAxisWord('winLose')
  return { id, opponent, winLoseWordShown, inverted: invertedFlag }
}

function generate(tier: Challenge500Tier) {
  const panelCount = tier === 1 ? 1 : 2
  const invertCount = pickInversionCount(tier, panelCount as 1 | 2)
  const invertedFlags = shuffle([...Array(panelCount)].map((_, i) => i < invertCount))
  const panels = Array.from({ length: panelCount }, (_, i) => buildPanel(i, invertedFlags[i]))

  const correctHandByPanel: Record<number, Hand> = {}
  const segmentsByPanel: Record<number, PromptSegment[]> = {}
  for (const panel of panels) {
    const winLoseWordEffective = panel.inverted ? opposite('winLose', panel.winLoseWordShown) : panel.winLoseWordShown
    correctHandByPanel[panel.id] = winLoseWordEffective === '勝つ' ? winningHandAgainst(panel.opponent) : losingHandAgainst(panel.opponent)
    segmentsByPanel[panel.id] = [
      { text: `${HAND_LABEL[panel.opponent]}に`, inverted: false },
      { text: panel.winLoseWordShown, inverted: panel.inverted },
      { text: '手を出せ！', inverted: false },
    ]
  }

  return { panels, correctHandByPanel, segmentsByPanel }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { panels, correctHandByPanel, segmentsByPanel } = spec.data as {
    panels: Panel[]
    correctHandByPanel: Record<number, Hand>
    segmentsByPanel: Record<number, PromptSegment[]>
  }
  const doneRef = useRef(false)
  const ready = useInputGateReady()
  const [doneByPanel, setDoneByPanel] = useState<Set<number>>(new Set())

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function tap(panelId: number, hand: Hand) {
    if (!ready || doneRef.current) return
    if (hand !== correctHandByPanel[panelId]) {
      finish(false)
      return
    }
    const next = new Set(doneByPanel)
    next.add(panelId)
    setDoneByPanel(next)
    if (next.size === panels.length) finish(true)
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-4 text-center select-none">
      <div className={panels.length > 1 ? 'grid grid-cols-2 gap-4' : ''}>
        {panels.map((panel) => (
          <div key={panel.id} className="flex flex-col items-center gap-3">
            <InversionPrompt segments={segmentsByPanel[panel.id]} />
            <div className="flex gap-2">
              {HANDS.map((hand) => (
                <button
                  key={hand}
                  onPointerDown={() => tap(panel.id, hand)}
                  disabled={doneByPanel.has(panel.id)}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-black text-white active:scale-90 ${
                    doneByPanel.has(panel.id) ? 'bg-white/30' : 'bg-white/10'
                  }`}
                >
                  {HAND_LABEL[hand]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const RpsCompoundChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500RpsCompound',
  generate,
  Component,
}
