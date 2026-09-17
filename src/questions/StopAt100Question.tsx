import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randFloat, randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * 「100で止めろ」：高速で増える数字を見ながらギリギリまで攻める、というドパガキの刺激追求そのもの。
 *
 * Ver.4.9: 旧仕様（rate 55〜75/秒、成功範囲98〜102の5段階）だと、成功幅を通過する実時間が
 * 平均で約77msしかなく、「正解を理解していてもほぼ成功しない」状態だった。狙う面白さ
 * （ギリギリを攻める緊張感）は残しつつ、rateを大きく落として成功幅を96〜104（9段階）へ
 * 拡大し、人間が実際に狙って止められる難易度に調整した（新レンジ通過には約230〜320ms、
 * 単純な視覚反応の最低時間帯に収まる）。
 */
function generate() {
  return { startValue: randInt(15, 35), rate: randFloat(28, 40) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { startValue, rate } = data as { startValue: number; rate: number }
  const timeToHundredMs = ((100 - startValue) / rate) * 1000
  return timeToHundredMs + TIMING_SAFETY.stopAt100.reactionBufferMs + TIMING_SAFETY.stopAt100.safetyMarginMs
}

/** 画面表示（SUCCESS_RANGEの幅から動的に組み立てる「96〜104でSTOP！」）と実際の成功判定を完全に一致させる。 */
const SUCCESS_RANGE = 4
const PERFECT_RANGE = 1
const GREAT_RANGE = 3

function judgeStop(value: number): { tier: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'; correct: boolean } {
  const diff = Math.abs(value - 100)
  if (diff <= PERFECT_RANGE) return { tier: 'PERFECT', correct: true }
  if (diff <= GREAT_RANGE) return { tier: 'GREAT', correct: true }
  if (diff <= SUCCESS_RANGE) return { tier: 'GOOD', correct: true }
  return { tier: 'MISS', correct: false }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { startValue, rate } = spec.data as { startValue: number; rate: number }
  const [display, setDisplay] = useState(startValue)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    function tick() {
      if (doneRef.current) return
      const elapsedSec = (performance.now() - startRef.current) / 1000
      setDisplay(Math.round(startValue + rate * elapsedSec))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    const failTimer = setTimeout(() => finish(startValue + Math.round(rate * (spec.targetTimeMs / 1000))), spec.targetTimeMs)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(stoppedAtValue: number) {
    if (doneRef.current) return
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const { correct, tier } = judgeStop(stoppedAtValue)
    onResult({
      correct,
      reactionMs: 0,
      tierOverride: tier,
      meta: { stoppedAtValue },
    })
  }

  function handleStop() {
    if (doneRef.current) return
    sfx.stopClick()
    finish(display)
  }

  return (
    <QuestionShell instruction={`${100 - SUCCESS_RANGE}〜${100 + SUCCESS_RANGE}でSTOP！`}>
      <button
        onPointerDown={handleStop}
        className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-cyan-400 to-blue-600 text-3xl font-black tabular-nums text-white active:scale-95"
      >
        {display}
      </button>
    </QuestionShell>
  )
}

export const StopAt100QuestionModule: QuestionModule = {
  id: 'stopAt100',
  category: 'timing',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
