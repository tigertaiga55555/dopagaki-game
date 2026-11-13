import type { ChallengeProblemSetItem } from '../challenge/types'
import type { EndlessQuestionSlot } from './useEndlessGame'
import type { Challenge500Tier } from '../questions/challenge500/types'
import type { FinalQuestionTag, QuestionTypeId } from '../types'

/**
 * Ver.6 Phase 8（ENDLESS Challenge）: EndlessQuestionSlot（normal/final/challenge500の
 * 3つの問題体系をタグ付けして保持する既存の型）と、Challenge基盤が既に持つ汎用の
 * ChallengeProblemSetItem（{type, targetTimeMs?, tags?, data}）を相互変換する。
 *
 * 既存のuseChallenge500.ts（specToProblemSetItem/problemSetItemToSpec）と同じ方針
 * （purely pure, Reactに依存しない）だが、ENDLESSは3つの問題体系を横断するため、
 * どの体系（kind）・どのtier（challenge500のみ）から来たかをdata内に
 * `__endlessKind`/`__endlessTier`として埋め込み、復元時に取り出す。
 * ChallengeProblemSetItem型自体（src/types.ts）は一切変更しない。
 */
interface EndlessReplayMeta {
  __endlessKind: EndlessQuestionSlot['kind']
  __endlessTier?: Challenge500Tier
}

export function endlessSlotToProblemSetItem(slot: EndlessQuestionSlot): ChallengeProblemSetItem {
  if (slot.kind === 'normal') {
    const meta: EndlessReplayMeta = { __endlessKind: 'normal' }
    return { type: slot.spec.type, targetTimeMs: slot.spec.targetTimeMs, data: { ...slot.spec.data, ...meta } }
  }
  if (slot.kind === 'final') {
    const meta: EndlessReplayMeta = { __endlessKind: 'final' }
    return { type: slot.spec.type, targetTimeMs: slot.spec.targetTimeMs, tags: slot.spec.tags, data: { ...slot.spec.data, ...meta } }
  }
  const meta: EndlessReplayMeta = { __endlessKind: 'challenge500', __endlessTier: slot.tier }
  return { type: slot.spec.type, data: { ...slot.spec.data, ...meta } }
}

let replayInstanceCounter = 0

export function problemSetItemToEndlessSlot(item: ChallengeProblemSetItem): EndlessQuestionSlot {
  replayInstanceCounter += 1
  const instanceId = `endless-replay-${replayInstanceCounter}`
  const { __endlessKind, __endlessTier, ...data } = item.data as Record<string, unknown> & EndlessReplayMeta

  if (__endlessKind === 'final') {
    return {
      kind: 'final',
      spec: { instanceId, type: item.type, tags: (item.tags ?? []) as FinalQuestionTag[], targetTimeMs: item.targetTimeMs ?? 0, data },
    }
  }
  if (__endlessKind === 'challenge500') {
    return { kind: 'challenge500', spec: { instanceId, type: item.type, data }, tier: __endlessTier as Challenge500Tier }
  }
  // __endlessKind === 'normal'、またはこのmigration以前の想定外データへの保険的フォールバック。
  return { kind: 'normal', spec: { instanceId, type: item.type as QuestionTypeId, targetTimeMs: item.targetTimeMs ?? 0, data } }
}
