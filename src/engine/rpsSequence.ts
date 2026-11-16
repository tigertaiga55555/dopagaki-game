import { pick, pickExcluding } from './random'

export type RpsHandId = 'rock' | 'scissors' | 'paper'

export const RPS_HAND_IDS: readonly RpsHandId[] = ['rock', 'scissors', 'paper']

/** 1手表示の時間（ミリ秒）。従来のFinalRps*Sequenceと同じ値を維持する。 */
export const RPS_HAND_STEP_MS = 700

/**
 * 各手を表示した後に必ず挟む「何も表示しない」間隔（ミリ秒）。テンポを壊さない程度に短いが、
 * 「前の手が消えて、次の手が出た」とはっきり視認できる長さ。3手目の後、回答フェーズに入る前にも
 * 同じ間隔を1回挟む。
 */
export const RPS_BLANK_MS = 200

/**
 * Ver.6 Phase 9（実機QA反映）: じゃんけん連続提示（3手/4手）の手配列生成をここに集約する。
 * 旧ロジック（FinalRpsForwardSequenceQuestion/FinalRpsReverseSequenceQuestion/
 * FinalUltimateRpsQuadReverseQuestionの各generate()に同一コードがコピペされていた）は
 * 隣接要素を完全に独立抽選していたため、👊→👊→👊のような「3連続で全く同じ手」が
 * 発生し得て、「3回見て覚える」という前提を壊していた。
 *
 * ここでは隣り合う手だけが同じにならないことを保証する（hand[0]!=hand[1]、hand[1]!=hand[2]、
 * ...）。hand[0]===hand[2]（1個飛ばしで同じ手に戻る、例：👊→✌️→👊）は明示的に許容する
 * （ユーザー指示どおり、これは禁止しない）。
 *
 * 1箇所で直した分だけ、これを使う全ての出題（FINAL DOPA TRIAL Q9〜12/Q13〜15/ULTIMATE
 * QUESTION、およびそれらのプールを再利用するENDLESS上級・各モードのChallenge新規生成）に
 * 一括で反映される。Challengeの既存リプレイ（過去に保存済みのproblemSet.items）はこの関数を
 * 一切呼ばない（保存済みデータをそのまま再生するだけ）ため、このロジック変更がすでに記録済みの
 * Challengeデータを書き換えることは絶対にない。
 */
export function generateRpsHandSequence(length: number): RpsHandId[] {
  const sequence: RpsHandId[] = []
  for (let i = 0; i < length; i++) {
    sequence.push(i === 0 ? pick(RPS_HAND_IDS) : pickExcluding(RPS_HAND_IDS, sequence[i - 1]))
  }
  return sequence
}

export type RpsRevealPhase = { kind: 'showing'; index: number } | { kind: 'blank' } | { kind: 'done' }

/**
 * 経過時間（elapsedMs）から「今どの手を表示すべきか／今は何も表示しない間（blank）か／
 * 全手の提示が完了したか」を純粋に計算する。タイマー実装（setTimeoutの積み上げ）から
 * ロジックを分離し、vitestで直接テストできるようにする。
 *
 * タイムライン（length=3、handMs=700、blankMs=200の場合）:
 *   [0,700) 1手目表示 → [700,900) blank → [900,1600) 2手目表示 → [1600,1800) blank →
 *   [1800,2500) 3手目表示 → [2500,2700) blank → 2700以降 done（回答フェーズへ）。
 * 3手目の後にも必ずblankを1回挟むため、「全部表示完了→少し空白→回答可能」という
 * フェーズ分離が明示的に保証される。
 */
export function rpsRevealPhaseAt(
  elapsedMs: number,
  length: number,
  handMs: number = RPS_HAND_STEP_MS,
  blankMs: number = RPS_BLANK_MS,
): RpsRevealPhase {
  const stepMs = handMs + blankMs
  for (let i = 0; i < length; i++) {
    const showStart = i * stepMs
    const showEnd = showStart + handMs
    const blankEnd = showEnd + blankMs
    if (elapsedMs < showEnd) return { kind: 'showing', index: i }
    if (elapsedMs < blankEnd) return { kind: 'blank' }
  }
  return { kind: 'done' }
}

/** 全手の提示＋最後のblankが終わるまでの合計時間（ミリ秒）。 */
export function rpsSequenceRevealTotalMs(
  length: number,
  handMs: number = RPS_HAND_STEP_MS,
  blankMs: number = RPS_BLANK_MS,
): number {
  return length * (handMs + blankMs)
}
