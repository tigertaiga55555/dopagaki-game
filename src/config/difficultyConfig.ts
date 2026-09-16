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
  /**
   * Ver.4.8: 終盤の難しさを「時間を削る」以外の手段でも作るための重み付け。
   * ここに挙げたタイプはプール内で複数回複製され、抽選で選ばれやすくなる
   * （＝出現率が上がるだけで、個々の問題のcomputeMinTargetTimeMsによる
   * 人間の最低時間保証は一切変わらない）。
   */
  weightedTypes?: Partial<Record<QuestionTypeId, number>>
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
    // Ver.4.2: GOまで押すな／100で止めろ／通知を消せ／変わったやつ、をここから解禁
    // Ver.4.3: 方向のみのswipeは初見で操作方法が伝わりづらいためプールから除外し、
    // 「← 食べ物  それ以外 →」の高速仕分け(foodSort)に置き換えた
    // Ver.4.5: 1→4／ターゲット探し／光ったやつ、をここから解禁
    pool: [
      'color',
      'maxNumber',
      'minNumber',
      'oddOneOut',
      'simpleMath',
      'repeatTap',
      'foodSort',
      'goWait',
      'stopAt100',
      'clearNotifications',
      'spotChange',
      'sequenceTap',
      'findTarget',
      'flashSpot',
    ],
    visualLevel: 1,
  },
  {
    id: 'fake',
    label: 'フェイクゾーン',
    startSec: 20,
    endSec: 30,
    speedMultiplier: 0.9,
    // Ver.4.2: SKIP待ち／連打→急停止、をここから解禁
    // Ver.4.5: 文字の色／ショート動画／緑で離せ、をここから解禁
    // Ver.4.8: 「連打→急停止」は2回の再設計を経ても初見での理解が困難でMISSも多発したため
    // 通常ローテーションから撤去（コード自体は削除せず残す）。代わりにMISSの一切ない
    // 「DOPA BONUS TIME」（bonusTime）をここから解禁する。
    pool: [
      'color',
      'maxNumber',
      'minNumber',
      'simpleMath',
      'repeatTap',
      'foodSort',
      'noPress',
      'differentOne',
      'goWait',
      'stopAt100',
      'clearNotifications',
      'spotChange',
      'skipWait',
      'bonusTime',
      'sequenceTap',
      'findTarget',
      'flashSpot',
      'colorWord',
      'shortVideoSwipe',
      'releaseZone',
    ],
    visualLevel: 2,
  },
  {
    id: 'boost',
    label: 'DOPA BOOST',
    startSec: 30,
    endSec: 40,
    speedMultiplier: 0.78,
    // Ver.4.2: ここから全問題タイプを対象に幅広く出題
    // Ver.4.5: 通知ラッシュをここから解禁（新お題は全種類がここで出揃う）
    // Ver.4.8: 「連打→急停止」をbonusTime（DOPA BONUS TIME）に置き換え
    pool: [
      'color',
      'maxNumber',
      'minNumber',
      'simpleMath',
      'repeatTap',
      'foodSort',
      'noPress',
      'differentOne',
      'sameOne',
      'moreSide',
      'holdPress',
      'goWait',
      'skipWait',
      'bonusTime',
      'stopAt100',
      'clearNotifications',
      'spotChange',
      'sequenceTap',
      'findTarget',
      'flashSpot',
      'colorWord',
      'shortVideoSwipe',
      'releaseZone',
      'notifRush',
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
      'foodSort',
      'repeatTap',
      'holdPress',
      'noPress',
      'goWait',
      'skipWait',
      'bonusTime',
      'stopAt100',
      'clearNotifications',
      'spotChange',
      'sequenceTap',
      'findTarget',
      'flashSpot',
      'colorWord',
      'shortVideoSwipe',
      'releaseZone',
      'notifRush',
    ],
    // Ver.4.8: 認知負荷の高いタイプの出現率を上げることで難易度を作る（時間はcomputeMinTargetTimeMsで保証済み）
    weightedTypes: { sequenceTap: 2, findTarget: 2, colorWord: 2, notifRush: 2, releaseZone: 2 },
    visualLevel: 4,
  },
  {
    id: 'finalRush',
    label: 'FINAL DOPA RUSH',
    startSec: 50,
    endSec: 60,
    speedMultiplier: 0.58,
    // Ver.4.2: 新問題も含め全タイプから高速出題。ただし各問題のcomputeMinTargetTimeMsにより
    // 「速すぎて物理的にクリア不能」にはならない
    // Ver.4.5: 新お題7種もここから全て対象（同様にcomputeMinTargetTimeMsで物理的な最低時間を保証）
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
      'foodSort',
      'repeatTap',
      'holdPress',
      'noPress',
      'goWait',
      'skipWait',
      'bonusTime',
      'stopAt100',
      'clearNotifications',
      'spotChange',
      'sequenceTap',
      'findTarget',
      'flashSpot',
      'colorWord',
      'shortVideoSwipe',
      'releaseZone',
      'notifRush',
    ],
    // Ver.4.8: FINAL DOPA RUSHは「時間を極限まで削る」のではなく、難しい種類の出現率と
    // 出題タイプの切り替え頻度で難易度を作る
    weightedTypes: { sequenceTap: 2, findTarget: 2, colorWord: 2, notifRush: 2, releaseZone: 2, repeatTap: 2 },
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
