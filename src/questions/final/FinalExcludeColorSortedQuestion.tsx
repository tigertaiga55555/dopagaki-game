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

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「◯以外を小さい順に全て押せ！」。
 * 色による除外＋数字の昇順処理の複合判断。除外色を2個、非除外色（3〜4色から3個）を混ぜる。
 */
function generate() {
  const excludeColor = pick(COLORS)
  const others = shuffle(COLORS.filter((c) => c.id !== excludeColor.id))
  const values = new Set<number>()
  while (values.size < 5) values.add(randInt(1, 30))
  const valueList = shuffle([...values])

  const other3 = others[randInt(0, others.length - 1)]
  const other4 = others[randInt(0, others.length - 1)]
  const items: Item[] = [
    { id: 0, value: valueList[0], colorId: excludeColor.id, hex: excludeColor.hex },
    { id: 1, value: valueList[1], colorId: excludeColor.id, hex: excludeColor.hex },
    { id: 2, value: valueList[2], colorId: others[0].id, hex: others[0].hex },
    { id: 3, value: valueList[3], colorId: other3.id, hex: other3.hex },
    { id: 4, value: valueList[4], colorId: other4.id, hex: other4.hex },
  ]
  const nonExcluded = items.filter((it) => it.colorId !== excludeColor.id)
  const order = [...nonExcluded].sort((a, b) => a.value - b.value).map((it) => it.id)
  return { items: shuffle(items), excludeColorId: excludeColor.id, excludeLabel: excludeColor.label, order }
}

function computeTargetTimeMs() {
  return TIMING_SAFETY.final.mixedMs
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
    if (item.colorId === excludeColorId) {
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
    <QuestionShell instruction={`${excludeLabel}（${colorSymbol(excludeColorId)}）以外を\n小さい順に全て押せ！`}>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onPointerDown={() => handleTap(it)}
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white active:scale-90"
            style={{ backgroundColor: `${it.hex}33` }}
          >
            {it.value}
            <span className="absolute right-1 top-0.5 text-xs" style={COLOR_SYMBOL_STYLE}>
              {colorSymbol(it.colorId)}
            </span>
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const FinalExcludeColorSortedModule: FinalQuestionModule = {
  id: 'finalExcludeColorSorted',
  tags: ['color', 'number', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
