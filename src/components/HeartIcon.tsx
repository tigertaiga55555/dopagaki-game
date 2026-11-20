interface Props {
  filled: boolean
  size?: number
  className?: string
}

/**
 * 次フェーズ（Profile/Heart UI強化ラウンド、item 1）: Heart所持数を❤️🤍の絵文字の
 * 文字列表示ではなく、専用のSVGアイコンで描く。絵文字はOS・フォントによって大きさ・
 * 位置・色味がズレるため（ShapeIcon.tsxが図形問題で絵文字/Unicode文字を避けたのと
 * 同じ理由）、常に同じ太さ・同じ比率で揃うSVGに統一する。filled=trueは満タン
 * （塗りのrose色）、falseは空（輪郭のみの薄い白）。
 */
export function HeartIcon({ filled, size = 22, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill={filled ? '#fb7185' : 'none'}
      stroke={filled ? '#fb7185' : 'rgba(255,255,255,0.3)'}
      strokeWidth={filled ? 0 : 1.6}
    >
      <path d="M12 20.6s-7.1-4.35-9.5-8.73C.86 8.6 2.73 5.2 6.1 5.2c1.9 0 3.42 1.04 4.37 2.66a.3.3 0 0 0 .52 0C12 6.24 13.52 5.2 15.42 5.2c3.37 0 5.24 3.4 3.6 6.67-2.4 4.38-9.5 8.73-9.5 8.73z" />
    </svg>
  )
}
