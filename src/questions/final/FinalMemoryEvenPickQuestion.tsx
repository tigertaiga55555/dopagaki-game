import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q9〜Q12（記憶＋判断プール）：「数字を覚えろ！」→「偶数だった数字を
 * 全て押せ！」。記憶した5つの数字の中から偶数だけを多重選択する（順不同、全部押せば成功）。
 * 奇数を1つでも押すと即MISS。偶数の個数は必ず2個以上になるよう生成する。
 */
function generate() {
  let list: number[] = []
  let evens: number[] = []
  // 偶数が2個未満だと多重選択として成立しないため、2個以上になるまで作り直す。
  while (evens.length < 2) {
    const numbers = new Set<number>()
    while (numbers.size < 5) numbers.add(randInt(1, 99))
    list = [...numbers]
    evens = list.filter((n) => n % 2 === 0)
  }
  return { numbers: list, evens }
}

/** computeTargetTimeMsが返すのは「回答フェーズだけ」の時間。記憶表示時間は別途保証されるため含めない。 */
function computeTargetTimeMs() {
  return TIMING_SAFETY.final.memoryAnswerMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { numbers, evens } = spec.data as { numbers: number[]; evens: number[] }
  const [revealed, setRevealed] = useState(true)
  const [cleared, setCleared] = useState<Set<number>>(new Set())
  const answerOrderRef = useRef(shuffle(numbers))
  const startRef = useRef<number | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setRevealed(false)
      startRef.current = performance.now()
      failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    }, TIMING_SAFETY.final.memoryRevealMs)
    return () => {
      clearTimeout(revealTimer)
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: startRef.current !== null ? performance.now() - startRef.current : 0 })
  }

  function handleTap(n: number) {
    if (revealed || guardRef.current!.isResolved || cleared.has(n)) return
    if (n % 2 !== 0) {
      finish(false)
      return
    }
    const next = new Set(cleared)
    next.add(n)
    setCleared(next)
    if (next.size >= evens.length) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  if (revealed) {
    return (
      <QuestionShell instruction="数字を覚えろ！">
        <div className="grid grid-cols-3 gap-3">
          {numbers.map((n, i) => (
            <div key={i} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-2xl font-black text-white">
              {n}
            </div>
          ))}
        </div>
      </QuestionShell>
    )
  }

  return (
    <QuestionShell sub="覚えた数字の中から" instruction={'偶数だった数字を\n全て押せ！'}>
      <div className="grid grid-cols-3 gap-3">
        {answerOrderRef.current.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(n)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white transition-opacity active:scale-90"
            style={{ opacity: cleared.has(n) ? 0.2 : 1 }}
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalMemoryEvenPickModule: FinalQuestionModule = {
  id: 'finalMemoryEvenPick',
  tags: ['memory', 'number'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
