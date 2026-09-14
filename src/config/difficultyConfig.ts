import type { DifficultyPhaseId, QuestionTypeId } from '../types'

export interface DifficultyPhase {
  id: DifficultyPhaseId
  label: string
  startSec: number
  endSec: number
  /** 各問題のbaseTargetTimeMsに掛ける倍率。小さいほど速く・難しい。 */
  speedMultiplier: number
  /** このフェーズで出題してよい問題タイプ */
  pool: QuestionTypeId[]
  /** 背景演出の最低レベル（0〜5） */
  visualLevel: number
}

export const DIFFICULTY_PHASES: DifficultyPhase[] = [
  {
    id: 'warmup',
    label: 'ウォームアップ',
    startSec: 0,
    endSec: 10,
    speedMultiplier: 1.15,
    pool: ['color', 'maxNumber', 'minNumber', 'oddOneOut'],
    visualLevel: 0,
  },
  {
    id: 'ramp',
    label: 'ランプアップ',
    startSec: 10,
    endSec: 20,
    speedMultiplier: 1.0,
    pool: ['color', 'maxNumber', 'minNumber', 'oddOneOut', 'simpleMath', 'repeatTap', 'swipe'],
    visualLevel: 1,
  },
  {
    id: 'fake',
    label: 'フェイクゾーン',
    startSec: 20,
    endSec: 30,
    speedMultiplier: 0.9,
    pool: ['color', 'maxNumber', 'minNumber', 'simpleMath', 'repeatTap', 'swipe', 'noPress', 'differentOne'],
    visualLevel: 2,
  },
  {
    id: 'boost',
    label: 'DOPA BOOST',
    startSec: 30,
    endSec: 40,
    speedMultiplier: 0.78,
    pool: [
      'color',
      'maxNumber',
      'minNumber',
      'simpleMath',
      'repeatTap',
      'swipe',
      'noPress',
      'differentOne',
      'sameOne',
      'moreSide',
      'holdPress',
    ],
    visualLevel: 3,
  },
  {
    id: 'overload',
    label: '刺激過多ゾーン',
    startSec: 40,
    endSec: 50,
    speedMultiplier: 0.68,
    pool: [
      'color',
      'oddOneOut',
      'maxNumber',
      'minNumber',
      'differentOne',
      'sameOne',
      'moreSide',
      'biggerShape',
      'simpleMath',
      'swipe',
      'repeatTap',
      'holdPress',
      'noPress',
    ],
    visualLevel: 4,
  },
  {
    id: 'finalRush',
    label: 'FINAL DOPA RUSH',
    startSec: 50,
    endSec: 60,
    speedMultiplier: 0.58,
    pool: [
      'color',
      'oddOneOut',
      'maxNumber',
      'minNumber',
      'differentOne',
      'sameOne',
      'moreSide',
      'biggerShape',
      'simpleMath',
      'swipe',
      'repeatTap',
      'holdPress',
      'noPress',
    ],
    visualLevel: 5,
  },
]

export function getPhaseAt(elapsedSec: number): DifficultyPhase {
  for (const phase of DIFFICULTY_PHASES) {
    if (elapsedSec < phase.endSec) return phase
  }
  return DIFFICULTY_PHASES[DIFFICULTY_PHASES.length - 1]
}

export const TOTAL_GAME_SEC = 60
export const FINAL_RUSH_START_SEC = 50
export const COUNTDOWN_START_SEC = 57
