import { V3_CONFIG } from '../config/gameConfigV3'
import { randInt, shuffle } from './random'
import type { DiagnosticCategory, EventId } from '../types'

export const EVENT_CATEGORY: Record<EventId, DiagnosticCategory> = {
  videoMemory: 'speed',
  skipQuiz: 'skip',
  comboBoost: 'impulse',
  instantReward: 'impulse',
  notificationReflex: 'notification',
  sortRush: 'stimulation',
  holdRelease: 'patience',
  adCountdown: 'skip',
  treasureBox: 'impulse',
  peekResult: 'result',
  gambleChoice: 'impulse',
}

/** 必ず含めたい候補（A〜I）＋バリエーション用のK。Jは終盤限定の低確率イベントとして別枠。 */
const MAIN_POOL: EventId[] = [
  'videoMemory',
  'skipQuiz',
  'comboBoost',
  'instantReward',
  'notificationReflex',
  'sortRush',
  'holdRelease',
  'adCountdown',
  'treasureBox',
  'gambleChoice',
]

/** 同じ行動カテゴリーのイベントが連続しすぎないよう、ベストエフォートで並び替える */
function dedupeConsecutiveCategories(ids: EventId[]): EventId[] {
  const arr = [...ids]
  for (let i = 1; i < arr.length; i++) {
    if (EVENT_CATEGORY[arr[i]] === EVENT_CATEGORY[arr[i - 1]]) {
      for (let j = i + 1; j < arr.length; j++) {
        if (EVENT_CATEGORY[arr[j]] !== EVENT_CATEGORY[arr[i - 1]]) {
          const tmp = arr[i]
          arr[i] = arr[j]
          arr[j] = tmp
          break
        }
      }
    }
  }
  return arr
}

/**
 * 1プレイぶんのイベント順序を組み立てる。
 * A〜I・Kの10候補からランダムに7〜8個選び、同じ行動カテゴリーの連続を避ける。
 * 低確率でEVENT J（途中診断チラ見）を終盤の追加イベントとして差し込む。
 */
export function buildEventSequence(): EventId[] {
  const count = randInt(V3_CONFIG.eventCountMin, V3_CONFIG.eventCountMax)
  const shuffled = shuffle(MAIN_POOL)
  const main = dedupeConsecutiveCategories(shuffled.slice(0, count))

  if (Math.random() < V3_CONFIG.peekEventChance) {
    main.push('peekResult')
  }

  return main
}
