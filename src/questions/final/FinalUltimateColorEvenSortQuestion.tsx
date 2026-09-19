import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { createResolveOnce } from '../../engine/resolveOnce'
import { pick, randInt, shuffle } from '../../engine/random'
import { colorSymbol, COLOR_SYMBOL_STYLE } from '../colorSymbols'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const COLORS = [
  { id: 'red', label: '赤', hex: '#ef4444' },
  { id: 'blue', label: '青', hex: '#3b82f6' },
  { id: 'green', label: '緑', hex: '#22c55e' },
  { id: 'yellow', label: '黄', hex: '#eab308' },
] as const
type ColorId = (typeof COLORS)[number]['id']

interface Item {
  id: number
  value: number
  colorId: ColorId
  hex: string
}

/** 除外色2〜3個を強制的に混ぜつつ残りをランダム配色し、「非除外色かつ偶数」が3個以上になるまで作り直す。 */
function buildCandidate() {
  const excludeColor = pick(COLORS)
  const others = COLORS.filter((c) => c.id !== excludeColor.id)
  const itemCount = randInt(6, 8)
  const forcedExcludedCount = randInt(2, 3)

  const values = new Set<number>()
  while (values.size < itemCount) values.add(randInt(1, 40))
  const valueList = shuffle([...values])

  const colorIds: ColorId[] = []
  for (let i = 0; i < forcedExcludedCount; i++) colorIds.push(excludeColor.id)
  for (let i = forcedExcludedCount; i < itemCount; i++) colorIds.push(pick(others).id)
  const shuffledColorIds = shuffle(colorIds)

  const items: Item[] = valueList.map((value, i) => {
    const colorId = shuffledColorIds[i]
    return { id: i, value, colorId, hex: COLORS.find((c) => c.id === colorId)!.hex }
  })
  const targets = items.filter((it) => it.colorId !== excludeColor.id && it.value % 2 === 0)
  const order = [...targets].sort((a, b) => a.value - b.value).map((it) => it.id)
  return { items, excludeColor, order }
}

/**
 * ULTIMATE QUESTION候補1（色除外＋偶数＋順序）：「◯以外の偶数を小さい順に全て押せ！」。
 * 色による除外→偶数抽出→昇順ソート→複数タップ、という4段階の処理を要求する
 * FINAL DOPA TRIAL卒業試験。既存Q13〜15のFinalExcludeColorSortedQuestion（色除外＋順序のみ、
 * 2段階）に「偶数抽出」を挟むことで処理ステップを1段階増やし、明確に上回る難度にする。
 * 6〜8個の候補から必ず3個以上の正解ターゲットが出るまで生成をやり直す（0〜1個の
 * 退化した問題を絶対に出さない）。
 */
function generate() {
  let candidate = buildCandidate()
  while (candidate.order.length < 3) candidate = buildCandidate()
  return {
    items: shuffle(candidate.items),
    excludeColorId: candidate.excludeColor.id,
    excludeLabel: candidate.excludeColor.label,
    order: candidate.order,
  }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.ultimate1Ms
}

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { items, excludeColorId, excludeLabel, order } = spec.data as {
    items: Item[]
    excludeColorId: ColorId
    excludeLabel: string
    order: number[]
  }
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
    const isTarget = item.colorId !== excludeColorId && item.value % 2 === 0
    if (!isTarget) {
      finish(false)
      return
    }
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
    <QuestionShell instruction={`${excludeLabel}（${colorSymbol(excludeColorId)}）以外の偶数を\n小さい順に全て押せ！`}>
      <div className="grid grid-cols-4 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white active:scale-90"
            style={{ backgroundColor: `${it.hex}33` }}
          >
            {it.value}
            <span className="absolute right-0.5 top-0 text-[10px]" style={COLOR_SYMBOL_STYLE}>
              {colorSymbol(it.colorId)}
            </span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalUltimateColorEvenSortModule: FinalQuestionModule = {
  id: 'finalUltimateColorEvenSort',
  tags: ['color', 'number', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
