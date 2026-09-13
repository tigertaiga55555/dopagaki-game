import type { DiagnosticCategory, DopagakiTypeDef } from '../types'

export const TITLE_TEXT = {
  heading: 'ドパガキゲーム',
  subCopy: '60秒でどこまで稼げる？',
  lines: ['次々出てくるゲームをクリアしてSCOREを稼げ。', 'プレイのクセから、あなたのドパガキ度も測定します。', '何が診断されているかは秘密。'],
  startButton: 'START',
}

/** 各イベント開始時、0.8〜1.2秒だけ表示する短い指示文 */
export const EVENT_INTROS: Record<string, string> = {
  videoMemory: 'よく見て答えろ',
  skipQuiz: '説明を読んで答えろ',
  comboBoost: '100％まで貯めろ',
  instantReward: '報酬を選べ',
  notificationReflex: '青になった瞬間タップ',
  sortRush: '食べ物は右へ',
  holdRelease: '離すタイミングを見極めろ',
  adCountdown: '5秒待てば+900',
  treasureBox: '当たりの箱を選べ',
  peekResult: 'チャンス演出',
  gambleChoice: '報酬を選べ',
}

/** ドパガキ度が極端に低いときの固定タイプ */
export const HERMIT_TYPE: DopagakiTypeDef = { id: 'hermit', name: 'ほぼ仙人' }
export const RATIONAL_TYPE: DopagakiTypeDef = { id: 'rational', name: '意外と理性ある型' }

/** 31%以上のとき、最もスコアが高かった行動カテゴリーで判定するタイプ */
export const CATEGORY_TYPES: Record<DiagnosticCategory, DopagakiTypeDef> = {
  stimulation: { id: 'stimulation', name: '刺激中毒型ドパガキ' },
  speed: { id: 'speed', name: '効率厨型ドパガキ' },
  impulse: { id: 'impulse', name: '連打脳型ドパガキ' },
  notification: { id: 'notification', name: '通知よわよわ型' },
  skip: { id: 'skip', name: 'スキップ常習型ドパガキ' },
  patience: { id: 'patience', name: '待てない型ドパガキ' },
  result: { id: 'result', name: '結果待てない型ドパガキ' },
}

export const RESULT_COMMENTS_HIGH = ['脳がずっと次の刺激を探しています。', '無音で電車乗れます？', '5秒広告、待てますか？']
export const RESULT_COMMENTS_MID = ['普通にドパガキです。', '理性と刺激が戦っています。', 'あと少しで仙人でした。']
export const RESULT_COMMENTS_LOW = ['ちゃんと待てる人間でした。', '令和では珍しい耐久力。', 'スマホに支配されていません。']

export function getResultComments(percent: number): string[] {
  if (percent >= 60) return RESULT_COMMENTS_HIGH
  if (percent >= 30) return RESULT_COMMENTS_MID
  return RESULT_COMMENTS_LOW
}

export const NEW_LOW_MESSAGE = '自己最低更新！（＝褒め言葉）'
export const NEW_HIGH_SCORE_MESSAGE = 'BEST SCORE更新！'

export function buildRetryLabel(playCount: number, lowestDopagaki: number, bestGameScore: number): string {
  if (playCount === 0) return 'もう一回やる'
  if (playCount % 2 === 0) return `BEST SCORE更新できる？（現在${bestGameScore.toLocaleString()}）`
  return `次は${Math.max(0, lowestDopagaki - 10)}％切れる？`
}

export function buildShareText(percent: number, typeName: string, gameScore: number, crimeText?: string): string {
  const lines = [`ドパガキ度${percent}％`, `${typeName}`, '', `GAME SCORE ${gameScore.toLocaleString()}`]
  if (crimeText) lines.push('', `「${crimeText}」`)
  lines.push('', 'あなたは何％？')
  return lines.join('\n')
}
