export const TITLE_TEXT = {
  heading: 'ドパガキゲーム',
  lines: ['60秒で刺激をさばけ。', '目指せ\nドパガキ度100％', '素早く、正確に。\n指示を見逃すな。'],
  startButton: 'START',
}

export function getRetryLabel(percent: number): string {
  if (percent > 100) return '限界突破する'
  if (percent === 100) return 'その先へ'
  if (percent >= 99) return 'リベンジ'
  if (percent >= 90) return 'もう一回'
  return '100％までやる'
}

export function getNearMissComment(percent: number): string | null {
  if (percent >= 99 && percent < 100) return 'あと1％でした。'
  if (percent >= 95 && percent < 99) return 'あと少しで100％でした。'
  return null
}

export const MILESTONE_TEXT = {
  finalRush: 'FINAL DOPA RUSH',
  hundredPercent: 'DOPAGAKI\n100％',
  hundredPercentSub: '完全体ドパガキ',
  overdrive: 'DOPA OVERDRIVE',
}

export function buildShareText(percent: number, typeName: string): string {
  if (percent > 100) {
    return `ドパガキ度 ${percent}％\n${typeName}\n\n100％が上限だと思ってた？`
  }
  return `ドパガキ度 ${percent}％\n${typeName}\n\n100％いける？`
}

export const V4_SHARE_URL = 'https://dopagaki-game.example.com'
