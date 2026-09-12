import { formatPoint } from '../utils/format'
import type { StepEffect } from '../types'

interface Props {
  currentPoint: number
  maxPoint: number
  effect?: StepEffect
  effectKey: number
}

function effectClass(effect: StepEffect | undefined): string {
  if (effect === 'crash') return 'anim-shake'
  if (effect === 'spike' || effect === 'bonus' || effect === 'recover' || effect === 'fakeReveal') {
    return 'anim-spike'
  }
  return ''
}

function pointColor(effect: StepEffect | undefined): string {
  if (effect === 'crash') return 'text-red-400'
  if (effect === 'spike' || effect === 'bonus' || effect === 'recover') return 'text-emerald-400'
  return 'text-white'
}

export function PointDisplay({ currentPoint, maxPoint, effect, effectKey }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-2 text-white/50">
        <span className="text-xs font-bold tracking-widest">最高</span>
        <span className="text-lg font-bold tabular-nums">{formatPoint(maxPoint)} pt</span>
      </div>
      <div
        key={effectKey}
        className={`text-6xl font-black tabular-nums drop-shadow-[0_0_25px_rgba(168,85,247,0.35)] transition-colors duration-150 ${pointColor(effect)} ${effectClass(effect)}`}
      >
        {formatPoint(currentPoint)}
        <span className="ml-1 text-2xl align-top">pt</span>
      </div>
    </div>
  )
}
