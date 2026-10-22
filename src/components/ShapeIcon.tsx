export type ShapeId = 'circle' | 'triangle' | 'square' | 'cross'

export const SHAPE_IDS: ShapeId[] = ['circle', 'triangle', 'square', 'cross']

export const SHAPE_LABELS: Record<ShapeId, string> = {
  circle: '○',
  triangle: '△',
  square: '□',
  cross: '×',
}

interface Props {
  shape: ShapeId
  size?: number
  color?: string
  className?: string
}

/**
 * Ver.6 Phase 1: 色識別が必要な問題を全廃し、色覚特性に依存しない図形（○△□×）で
 * 置き換えるための共通描画コンポーネント。Unicode文字（○△□×）はフォント・端末による
 * 見た目の差が大きいため使わず、常に同じ太さ・同じ比率で描けるSVGで統一する。
 * 正解条件は常に「どの図形か」のみで決まり、色はこのコンポーネントの外側で
 * 装飾目的にのみ使ってよい（デフォルトは白一色）。
 */
export function ShapeIcon({ shape, size = 48, color = '#ffffff', className }: Props) {
  const stroke = Math.max(3, Math.round(size * 0.12))
  const viewBox = 100
  const pad = stroke + 6

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      className={className}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {shape === 'circle' && <circle cx={50} cy={50} r={50 - pad} fill="none" stroke={color} strokeWidth={stroke} />}
      {shape === 'square' && (
        <rect
          x={pad}
          y={pad}
          width={viewBox - pad * 2}
          height={viewBox - pad * 2}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      )}
      {shape === 'triangle' && (
        <polygon
          points={`50,${pad - 2} ${viewBox - pad},${viewBox - pad} ${pad},${viewBox - pad}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      )}
      {shape === 'cross' && (
        <>
          <line x1={pad} y1={pad} x2={viewBox - pad} y2={viewBox - pad} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <line x1={viewBox - pad} y1={pad} x2={pad} y2={viewBox - pad} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
