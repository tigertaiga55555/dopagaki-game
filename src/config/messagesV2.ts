import type { DopagakiTypeDef, EventCategory, EventId } from '../types'

/** タイトル画面の文言 */
export const TITLE_TEXT = {
  heading: 'ドパガキゲーム',
  subCopy: 'あなたのスマホ脳、何％ドパガキ？',
  lines: ['約60秒でドパガキ度を測定します。', '何が採点されているかは秘密です。', '画面の指示に従って、いつも通り操作してください。'],
  startButton: '測定を始める',
}

/** イベント終了後、スコアが高いときに表示する煽り文（1イベントにつきランダムで1つ） */
export const TAUNTS_BY_EVENT: Partial<Record<EventId, string[]>> = {
  loading: ['そんな押しても速くならないよ。', 'まだ72%だったのに。'],
  notification: ['通知、早すぎ。', '内容も見てないでしょ。'],
  stimulusFree: ['今、何か流したくなった？', '無音、苦手？'],
  fakeResult: ['結果だけは早く見たいんだ。', 'まだ測定中だって。'],
  rapidTap: ['連打しても変わらないよ。', 'ボタン、壊れてないよ。'],
  tapSpeed: ['タップ、意味ないのに。'],
  shortContent: ['もう飽きた？'],
  speedToggle: ['等速、無理だった？'],
  finalTrap: ['3秒も待てないとは。'],
  instantReward: ['我慢できなかったね。'],
  unresponsive: ['じっとしてられない？'],
  skip: ['読んでないでしょ、それ。'],
}

/** 犯行記録：スコアが高いイベントについて、測定値から一文を生成する */
export const crimeText = {
  skip: (sec: number) => `説明を${sec.toFixed(1)}秒でSKIPしました。`,
  loading: (sec: number) => `99%ロードを${sec.toFixed(1)}秒で見限りました。`,
  rapidTap: (count: number) => `反応しないボタンを${count}回連打しました。`,
  notification: (sec: number) => `通知を${sec.toFixed(2)}秒で開きました。`,
  stimulusFree: (sec: number) => `無音の時間に${sec.toFixed(1)}秒で音楽を求めました。`,
  shortContent: (sec: number) => `ショート風コンテンツを${sec.toFixed(1)}秒でスワイプしました。`,
  tapSpeed: (count: number) => `意味のないタップを${count}回してしまいました。`,
  unresponsive: (count: number) => `反応がない時間に${count}回操作しました。`,
  instantReward: (sec: number) => `即時報酬を${sec.toFixed(1)}秒で選びました。`,
  speedToggle: (sec: number) => `2倍速に${sec.toFixed(1)}秒で変更しました。`,
  fakeResult: (sec: number) => `「結果を見る」を${sec.toFixed(1)}秒で押しました。`,
  finalTrap: (sec: number) => `結果を${sec.toFixed(1)}秒で見ようとしました。`,
} satisfies Record<EventId, (value: number) => string>

/** ドパガキ度が極端に低いときの固定タイプ */
export const HERMIT_TYPE: DopagakiTypeDef = { id: 'hermit', name: 'ほぼ仙人' }
export const RATIONAL_TYPE: DopagakiTypeDef = { id: 'rational', name: '意外と理性ある型' }

/** 35%以上のとき、最もスコアが高かった行動カテゴリーで判定するタイプ */
export const CATEGORY_TYPES: Record<EventCategory, DopagakiTypeDef> = {
  stimulation: { id: 'stimulation', name: '刺激中毒型ドパガキ' },
  impatience: { id: 'impatience', name: 'せっかち型ドパガキ' },
  notification: { id: 'notification', name: '通知よわよわ型' },
  skip: { id: 'skip', name: 'スキップ常習型ドパガキ' },
  impulse: { id: 'impulse', name: '連打脳型ドパガキ' },
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

export function buildShareText(percent: number, typeName: string): string {
  return `ドパガキ度${percent}％\n「${typeName}」でした。\n\nあなたは何％？`
}
