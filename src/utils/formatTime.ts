/**
 * 次フェーズ（Profile/Heart UI強化ラウンド）: HeartEmptyModal.tsx専用だったmm:ss表示を
 * 共通化し、新設のHeartDisplay.tsx/HeartDetailModal.tsxとも共有する（同じフォーマットを
 * 複数箇所で再実装しない）。
 */
export function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
