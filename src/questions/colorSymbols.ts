/**
 * Ver.5.1追加: 色覚特性への対応。「赤だけ消せ！」のように色だけを判断材料にしていた
 * 問題に、色と1:1で対応する記号を重ねて表示することで、色を判別しにくいプレイヤーでも
 * 記号だけで正解を判断できるようにする。通常の色覚のプレイヤーには、既存のスウォッチの
 * 上に控えめな記号が乗る程度で、見た目・難易度はほぼ変わらない。
 */
export const COLOR_SYMBOLS: Record<string, string> = {
  red: '●',
  green: '▲',
  blue: '■',
  yellow: '★',
  purple: '◆',
}

export function colorSymbol(colorId: string): string {
  return COLOR_SYMBOLS[colorId] ?? ''
}

/**
 * どの背景色の上に乗せても視認できるよう、白地に黒っぽい縁取り（text-shadow）を
 * 重ねる共通スタイル。彩度・明度に関わらず記号の形そのもので判断できることを狙う。
 */
export const COLOR_SYMBOL_STYLE = {
  color: '#ffffff',
  textShadow: '0 0 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.55)',
} as const
