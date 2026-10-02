import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { type InversionAxis, opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import type { EndlessQuestionComponentProps, EndlessQuestionModule } from './types'

const SWIPE_THRESHOLD_PX = 50
const AXES: InversionAxis[] = ['leftRight', 'upDown']
const ARROW_FOR: Record<string, string> = { 左: '←', 右: '→', 上: '↑', 下: '↓' }

/**
 * Ver.6 Phase 1: 下線反転ギミックのテンプレート3（スワイプ方向）。1回のジェスチャーで
 * 完結する性質上、tier1（200〜299%、1箇所反転）専用のバリエーションとして実装している
 * （NumberPick/ShapeCountPickの2テンプレートがtier1〜3をフルに担当する）。
 */
function generate() {
  const axis = pick(AXES)
  const shownWord = pickAxisWord(axis)
  const effectiveWord = opposite(axis, shownWord)
  const segments: PromptSegment[] = [{ text: shownWord, inverted: true }, { text: 'にスワイプ！', inverted: false }]
  return { effectiveWord, segments }
}

function Component({ spec, onResult }: EndlessQuestionComponentProps) {
  const { effectiveWord, segments } = spec.data as { effectiveWord: string; segments: PromptSegment[] }
  const doneRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const ready = useInputGateReady()

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct })
  }

  function handlePointerDown(e: ReactPointerEvent) {
    if (!ready) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    if (!ready || !dragStartRef.current || doneRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    dragStartRef.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return
    const actual = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '右' : '左') : dy > 0 ? '下' : '上'
    finish(actual === effectiveWord)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartRef.current = null
      }}
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <InversionPrompt segments={segments} />
      <p className="text-7xl font-black text-white/70">{ARROW_FOR[segments[0].text]}</p>
    </div>
  )
}

export const SwipeDirectionEndlessModule: EndlessQuestionModule = {
  id: 'endlessSwipeDirection',
  generate,
  Component,
}
