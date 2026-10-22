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
const ALL_WORDS = ['左', '右', '上', '下']

/**
 * Ver.6 Phase 1（追加分）: FINAL DOPA TRIALの`FinalIgnoreArrowSwipeQuestion`
 * （「矢印は無視！文字の方向へスワイプ！」というストループ課題）を500%向けに転用。
 * 元の問題は文字の指示を常にそのまま読む（反転なし）が、こちらは文字そのものに
 * 下線反転ギミックを組み合わせる点が新規性——矢印という視覚的な妨害要素を無視しつつ、
 * 文字の指示が反転しているかどうかも同時に見極める必要があり、既存の
 * SwipeDirectionQuestion（妨害要素なし）より明確に難しい干渉課題になる。
 *
 * 矢印の向きは文字とは完全に独立な乱数で生成し、正誤判定には一切使わない
 * （常に無視すべきダミー）。スワイプという1回のジェスチャーで完結する性質上、
 * 反転候補は常に1箇所のみ（maxSlots=1）で、SwipeDirectionQuestionと同じくtier1
 * （200〜299%）専用のバリエーションとして実装する。
 */
function generate() {
  const arrowWord = pick(ALL_WORDS)
  const axis = pick(AXES)
  const shownWord = pickAxisWord(axis)
  const inverted = pickInversionCount(1, 1) === 1
  const effectiveWord = inverted ? opposite(axis, shownWord) : shownWord
  const segments: PromptSegment[] = [{ text: shownWord, inverted }, { text: 'にスワイプ！', inverted: false }]
  return { arrowWord, effectiveWord, segments }
}

function Component({ spec, onResult }: Challenge500QuestionComponentProps) {
  const { arrowWord, effectiveWord, segments } = spec.data as { arrowWord: string; effectiveWord: string; segments: PromptSegment[] }
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
      className="flex h-full w-full touch-none select-none flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <p className="text-sm font-black tracking-widest text-white/40">矢印は無視！</p>
      <InversionPrompt segments={segments} />
      <p className="text-8xl font-black text-white/70 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">{ARROW_FOR[arrowWord]}</p>
    </div>
  )
}

export const InterferenceSwipeChallenge500Module: Challenge500QuestionModule = {
  id: 'challenge500InterferenceSwipe',
  generate,
  Component,
}
