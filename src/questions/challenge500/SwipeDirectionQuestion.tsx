import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { InversionPrompt, type PromptSegment } from '../../components/InversionPrompt'
import { type InversionAxis, opposite, pickAxisWord } from '../../engine/inversion/words'
import { pick } from '../../engine/random'
import { useInputGateReady } from '../useInputGateReady'
import { pickInversionCount } from './inversionPicker'
import type { Challenge500QuestionComponentProps, Challenge500QuestionModule } from './types'

const SWIPE_THRESHOLD_PX = 50
const AXES: InversionAxis[] = ['leftRight', 'upDown']
const ARROW_FOR: Record<string, string> = { 左: '←', 右: '→', 上: '↑', 下: '↓' }

/**
 * Ver.6 Phase 1（再設計版）: 下線反転ギミックのテンプレート3（スワイプ方向）。1回の
 * ジェスチャーで完結する性質上、反転候補は常に1箇所のみ（maxSlots=1）であり、
 * tier1（200〜299%）専用のバリエーションとして実装している（NumberPick/ShapeCountPick
 * の2テンプレートがtier1〜3をフルに担当し、tier2/3向けの複合スワイプは別テンプレート
 * （CompoundSwipeQuestion）として用意する）。
 *
 * 反転するかどうか（0/1）はpickInversionCountで毎回抽選し、反転しない場合は下線を付けず
 * 文字どおりの方向にスワイプするのが正解になる（反転なし問題を必ず混在させる）。
 */
function generate() {
  const axis = pick(AXES)
  const shownWord = pickAxisWord(axis)
  const inverted = pickInversionCount(1, 1) === 1
  const effectiveWord = inverted ? opposite(axis, shownWord) : shownWord
  const segments: PromptSegment[] = [{ text: shownWord, inverted }, { text: 'にスワイプ！', inverted: false }]
  return { effectiveWord, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
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

export const SwipeDirectionChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500SwipeDirection',
  generate,
  Component,
}
