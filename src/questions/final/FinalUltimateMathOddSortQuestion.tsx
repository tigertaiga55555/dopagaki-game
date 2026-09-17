import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { randInt, shuffle } from '../../engine/random'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

interface Item {
  id: number
  value: number
}

function buildCandidate() {
  const a = randInt(2, 9)
  const b = randInt(2, 9)
  const sum = a + b
  const itemCount = randInt(6, 8)
  const values = new Set<number>()
  while (values.size < itemCount) values.add(randInt(1, sum + 20))
  const valueList = shuffle([...values])
  const targetValues = valueList.filter((v) => v > sum && v % 2 !== 0)
  const items: Item[] = valueList.map((value, id) => ({ id, value }))
  const order = [...targetValues].sort((x, y) => x - y).map((v) => items.find((it) => it.value === v)!.id)
  return { a, b, sum, items, order }
}

/**
 * ULTIMATE QUESTION候補3（計算＋条件抽出＋順序）：「計算の答えより大きい奇数を
 * 小さい順に全て押せ！」。既存Q13〜15のFinalMathThresholdQuestion（計算＋比較で単発1タップ）
 * に「奇数のみ」という条件を追加し、さらに複数タップ＋昇順ソートを要求することで
 * 明確に上回る難度にする。6〜8個の候補から正解ターゲットが3個以上出るまで作り直す。
 */
function generate() {
  let candidate = buildCandidate()
  while (candidate.order.length < 3) candidate = buildCandidate()
  return { a: candidate.a, b: candidate.b, sum: candidate.sum, items: shuffle(candidate.items), order: candidate.order }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.ultimate3Ms
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { a, b, items, order } = spec.data as { a: number; b: number; sum: number; items: Item[]; order: number[] }
  const [clearedCount, setClearedCount] = useState(0)
  const startRef = useRef(performance.now())
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handleTap(item: Item) {
    if (guardRef.current!.isResolved) return
    const expected = order[clearedCount]
    if (item.id !== expected) {
      finish(false)
      return
    }
    const next = clearedCount + 1
    setClearedCount(next)
    if (next >= order.length) {
      finish(true)
      return
    }
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
  }

  return (
    <QuestionShell instruction={'計算の答えより大きい奇数を\n小さい順に全て押せ！'}>
      <p className="text-3xl font-black text-white/80">
        {a} ＋ {b} ＝ ？
      </p>
      <div className="grid grid-cols-4 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-white active:scale-90"
          >
            {it.value}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalUltimateMathOddSortModule: FinalQuestionModule = {
  id: 'finalUltimateMathOddSort',
  tags: ['math', 'number'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
