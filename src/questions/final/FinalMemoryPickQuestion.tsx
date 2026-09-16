import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

/**
 * FINAL DOPA TRIAL Q9〜Q12（記憶＋判断プール）：「数字を覚えろ！」→「2番目に大きかった
 * 数字を押せ！」。
 *
 * 重要（完了報告の「記憶問題の時間設計」要件）：指示表示→記憶刺激表示→刺激を消す→回答UI、
 * を明確に分ける。回答用のtimeoutは回答UIが操作可能になった瞬間から開始し、記憶表示中は
 * 一切timeoutを消費しない（内部で別々のsetTimeoutとして管理する）。
 */
function generate() {
  const numbers = new Set<number>()
  while (numbers.size < 5) numbers.add(randInt(1, 99))
  const sorted = [...numbers].sort((a, b) => b - a)
  return { numbers: [...numbers], target: sorted[1] }
}

/** computeTargetTimeMsが返すのは「回答フェーズだけ」の時間。記憶表示時間は別途保証されるため含めない。 */
function computeTargetTimeMs() {
  return TIMING_SAFETY.final.memoryAnswerMs
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { numbers, target } = spec.data as { numbers: number[]; target: number }
  const [revealed, setRevealed] = useState(true)
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
    if (revealed || guardRef.current!.isResolved) return
    finish(n === target)
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
    <QuestionShell sub="覚えた数字の中から" instruction="2番目に大きかった数字を押せ！">
      <div className="grid grid-cols-3 gap-3">
        {answerOrderRef.current.map((n, i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(n)}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalMemoryPickModule: FinalQuestionModule = {
  id: 'finalMemoryPick',
  tags: ['memory', 'number'],
  tier: 'memory',
  generate,
  computeTargetTimeMs,
  Component,
}
