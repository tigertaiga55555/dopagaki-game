import { V2_CONFIG } from '../config/gameConfigV2'
import { shuffle } from './random'
import type { EventCategory, EventId } from '../types'

export const EVENT_CATEGORY: Record<EventId, EventCategory> = {
  skip: 'skip',
  loading: 'impatience',
  rapidTap: 'impulse',
  notification: 'notification',
  stimulusFree: 'stimulation',
  shortContent: 'stimulation',
  tapSpeed: 'impulse',
  unresponsive: 'impatience',
  instantReward: 'impulse',
  speedToggle: 'stimulation',
  fakeResult: 'result',
  finalTrap: 'result',
}

/** 最初（skip）と最後（finalTrap）を除いた、中盤でランダムに選ぶイベント候補 */
const MIDDLE_POOL: EventId[] = [
  'loading',
  'rapidTap',
  'notification',
  'stimulusFree',
  'shortContent',
  'tapSpeed',
  'unresponsive',
  'instantReward',
  'speedToggle',
  'fakeResult',
]

function categoryAt(arr: EventId[], i: number): EventCategory {
  if (i < 0) return 'skip'
  if (i >= arr.length) return 'result'
  return EVENT_CATEGORY[arr[i]]
}

/** arr[i] が前後と同じカテゴリーで連続してしまっている場合、後方の異なるカテゴリーの要素と入れ替える */
function swapAwayFromNeighbors(arr: EventId[], i: number): void {
  for (let j = i + 1; j < arr.length; j++) {
    if (EVENT_CATEGORY[arr[j]] !== categoryAt(arr, i - 1) && EVENT_CATEGORY[arr[j]] !== categoryAt(arr, i + 1)) {
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
      return
    }
  }
}

/** 同じ行動カテゴリーのイベントが連続しすぎないよう、ベストエフォートで並び替える */
function dedupeConsecutiveCategories(middle: EventId[]): EventId[] {
  const arr = [...middle]
  for (let i = 0; i < arr.length; i++) {
    if (categoryAt(arr, i) === categoryAt(arr, i - 1)) {
      swapAwayFromNeighbors(arr, i)
    }
  }
  // 最後の要素は finalTrap（result）と隣接するので、result同士の連続にならないか最後にもう一度確認する
  const lastIndex = arr.length - 1
  if (categoryAt(arr, lastIndex) === 'result') {
    swapAwayFromNeighbors(arr, lastIndex)
  }
  return arr
}

/**
 * 1プレイぶんのイベント順序を組み立てる。
 * 最初は必ず説明SKIP、最後は必ず結果罠。中盤はプールからランダムに選び、
 * 同じイベントの重複と、同じ行動カテゴリーの連続をできるだけ避ける。
 */
export function buildEventSequence(): EventId[] {
  const shuffled = shuffle(MIDDLE_POOL)
  const middle = dedupeConsecutiveCategories(shuffled.slice(0, V2_CONFIG.middleEventCount))
  return ['skip', ...middle, 'finalTrap']
}
