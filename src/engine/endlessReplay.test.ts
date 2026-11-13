import { describe, expect, it } from 'vitest'
import { endlessSlotToProblemSetItem, problemSetItemToEndlessSlot } from './endlessReplay'
import type { EndlessQuestionSlot } from './useEndlessGame'

describe('endlessSlotToProblemSetItem / problemSetItemToEndlessSlot (Ver.6 Phase 8: ENDLESS Challenge再生)', () => {
  it('normal: 往復変換でtype/targetTimeMs/dataが保持される', () => {
    const slot: EndlessQuestionSlot = {
      kind: 'normal',
      spec: { instanceId: 'x', type: 'maxNumber', targetTimeMs: 3000, data: { answer: 5 } },
    }
    const item = endlessSlotToProblemSetItem(slot)
    expect(item.type).toBe('maxNumber')
    expect(item.targetTimeMs).toBe(3000)
    expect(item.data.answer).toBe(5)

    const restored = problemSetItemToEndlessSlot(item)
    expect(restored.kind).toBe('normal')
    if (restored.kind !== 'normal') throw new Error('expected normal')
    expect(restored.spec.type).toBe('maxNumber')
    expect(restored.spec.targetTimeMs).toBe(3000)
    expect(restored.spec.data).toEqual({ answer: 5 })
  })

  it('final: 往復変換でtype/tags/targetTimeMs/dataが保持される', () => {
    const slot: EndlessQuestionSlot = {
      kind: 'final',
      spec: { instanceId: 'x', type: 'finalMemory', tags: ['memory'], targetTimeMs: 4000, data: { foo: 'bar' } },
    }
    const item = endlessSlotToProblemSetItem(slot)
    const restored = problemSetItemToEndlessSlot(item)
    expect(restored.kind).toBe('final')
    if (restored.kind !== 'final') throw new Error('expected final')
    expect(restored.spec.type).toBe('finalMemory')
    expect(restored.spec.tags).toEqual(['memory'])
    expect(restored.spec.targetTimeMs).toBe(4000)
    expect(restored.spec.data).toEqual({ foo: 'bar' })
  })

  it('challenge500: 往復変換でtype/tier/dataが保持される（targetTimeMs概念は持たない）', () => {
    const slot: EndlessQuestionSlot = {
      kind: 'challenge500',
      spec: { instanceId: 'x', type: 'sequenceRank', data: { order: [1, 2, 3] } },
      tier: 2,
    }
    const item = endlessSlotToProblemSetItem(slot)
    expect(item.targetTimeMs).toBeUndefined()
    const restored = problemSetItemToEndlessSlot(item)
    expect(restored.kind).toBe('challenge500')
    if (restored.kind !== 'challenge500') throw new Error('expected challenge500')
    expect(restored.spec.type).toBe('sequenceRank')
    expect(restored.spec.data).toEqual({ order: [1, 2, 3] })
    expect(restored.tier).toBe(2)
  })

  it('復元後のdataに__endlessKind/__endlessTierが残らない（元のdataと同じキー集合になる）', () => {
    const slot: EndlessQuestionSlot = {
      kind: 'challenge500',
      spec: { instanceId: 'x', type: 'foo', data: { a: 1, b: 2 } },
      tier: 1,
    }
    const item = endlessSlotToProblemSetItem(slot)
    const restored = problemSetItemToEndlessSlot(item)
    if (restored.kind !== 'challenge500') throw new Error('expected challenge500')
    expect(Object.keys(restored.spec.data).sort()).toEqual(['a', 'b'])
  })

  it('JSON往復（実際のD1保存/取得と同じシリアライズ）を経ても同じ内容を復元できる', () => {
    const slot: EndlessQuestionSlot = {
      kind: 'final',
      spec: { instanceId: 'x', type: 'finalReverse', tags: ['reverse'], targetTimeMs: 2500, data: { word: '右' } },
    }
    const item = endlessSlotToProblemSetItem(slot)
    const roundTripped = JSON.parse(JSON.stringify(item))
    const restored = problemSetItemToEndlessSlot(roundTripped)
    expect(restored).toEqual({
      kind: 'final',
      spec: { instanceId: expect.any(String), type: 'finalReverse', tags: ['reverse'], targetTimeMs: 2500, data: { word: '右' } },
    })
  })
})
