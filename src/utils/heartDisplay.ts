/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 1/3/4）: Heart所持数から「5枠表示に
 * どう描くか」を決める純粋関数。DOM/Reactに依存しないため直接vitestで検証できる
 * （HeartDisplay.tsx側は、この戻り値をそのままHeartIconの配列・回復timer表示有無へ
 * 変換するだけの薄いラッパーにする）。
 *
 * 所持数は自然回復上限（HEART_CAP）を超えて持てる設計（heartRepository.ts参照、
 * 購入/Rewarded Ad/DOPA PASSで将来5を超える想定）のため、5枠を超えた分は
 * `overflow`として別途返す（表示側は「❤️❤️❤️❤️❤️ +3」のように描く）。
 */
export interface HeartSlotsView {
  /** 塗りで表示するハートの数（0〜totalSlots）。 */
  filledSlots: number
  /** 常に表示する枠の総数（= HEART_CAP）。 */
  totalSlots: number
  /** 5枠を超えて所持している場合の超過数（0以上）。 */
  overflow: number
  /** 自然回復上限未満の間だけ、次の回復までのカウントダウンを表示する。 */
  showRecoveryTimer: boolean
}

export function computeHeartSlotsView(count: number, cap: number): HeartSlotsView {
  const safeCount = Math.max(0, count)
  return {
    filledSlots: Math.min(safeCount, cap),
    totalSlots: cap,
    overflow: Math.max(0, safeCount - cap),
    showRecoveryTimer: safeCount < cap,
  }
}
