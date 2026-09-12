/**
 * ゲーム中・結果画面で使うメッセージ集。
 * 文言はここを編集するだけで全体に反映される。
 */

/** ゲーム中、ランダムに表示される「あおり」メッセージ */
export const TAUNT_MESSAGES: string[] = [
  '今が押し時です。',
  'もう十分じゃない？',
  'まだ待つの？',
  '欲張るね。',
  '92％の人がここで押しています。',
  'ここから下がるかもよ？',
  '次は上がると思ってる？',
  '押せ。',
  '本当に待つんだ。',
  '暇になってきた？',
  'そろそろショート動画見たくない？',
  'さっき押しておけばよかったね。',
  'まだ取り返せると思ってる？',
  'その判断、本当に合ってる？',
  'あと少し。',
  '今なら間に合う。',
  '知らないよ？',
  'ここまで来たら逆に押せないよね。',
  '我慢できてえらい。',
  '……まだいるの？',
]

/** 初めての暴落専用メッセージ（驚きを演出） */
export const FIRST_CRASH_MESSAGES: string[] = [
  'え、下がるの？',
  '……あれ？',
  'ここにきて下落。',
  '油断したね。',
]

/** 通常の暴落時メッセージ */
export const CRASH_MESSAGES: string[] = [
  'うわ、下がった。',
  'それは予想外。',
  'さっき押しておけばよかったね。',
  '……ごめん。',
  'これは痛い。',
]

/** 急上昇・インフレ時メッセージ */
export const SPIKE_MESSAGES: string[] = [
  'きたっ！',
  'これは伸びる。',
  '今がチャンスかも？',
  '一気に上昇！',
]

/** 暴落からの復活時メッセージ */
export const RECOVER_MESSAGES: string[] = [
  'ほら、戻ってきた。',
  '今度は信じる？',
  '諦めなくてよかったね。',
]

/** フェイクボーナス演出：予告 */
export const FAKE_BONUS_ANNOUNCE: string[] = ['ボーナスタイム！', '今だけ特別チャンス！']

/** フェイクボーナス演出：カウントダウン中の煽り */
export const FAKE_BONUS_COUNTDOWN_LABEL = 'あと3秒で2倍！？'

/** フェイクボーナス結果：本当に2倍になった場合 */
export const FAKE_BONUS_WIN_MESSAGES: string[] = ['本当に2倍になった！', 'やったね、大当たり。']

/** フェイクボーナス結果：何も起きなかった場合 */
export const FAKE_BONUS_NOTHING_MESSAGES: string[] = [
  '……何も起きませんでした。',
  '残念、フェイクでした。',
  '期待して損したね。',
]

/** フェイクボーナス結果：逆に下がった場合 */
export const FAKE_BONUS_DROP_MESSAGES: string[] = ['え、下がるの!?', '騙されたね。', 'それはひどい。']

/** 謎のカウントダウン演出（何のカウントか説明しない） */
export const MYSTERY_COUNTDOWN_LABEL = '残り3秒。'
export const MYSTERY_RESOLVE_MESSAGES: string[] = [
  '……特に何もありませんでした。',
  '今のは何だったんだろう。',
]

/** 期間限定風フラットボーナス */
export const FLAT_BONUS_MESSAGES: string[] = ['今だけ＋ポイント！', '限定ボーナス発生！']

/** 最高記録更新時の演出メッセージ */
export const NEW_BEST_MESSAGE = '自己ベスト更新！'

/** 自動確定（時間切れ）時のメッセージ */
export const AUTO_END_MESSAGE = '我慢しすぎ！ボーナス付きで自動確定されました。'

/** 結果コメント（低得点） */
export const RESULT_COMMENTS_LOW: string[] = [
  '脳が刺激を求めています。',
  '5秒広告も待てなそう。',
  '押すの早すぎ。',
  'ショート動画に帰ってください。',
]

/** 結果コメント（中間） */
export const RESULT_COMMENTS_MID: string[] = [
  '普通にドパガキです。',
  'あと少し我慢できました。',
  '欲と理性が戦っています。',
  '意外と待てる人間でした。',
]

/** 結果コメント（高得点） */
export const RESULT_COMMENTS_HIGH: string[] = [
  'ちゃんと待てる人間でした。',
  '令和では珍しい耐久力。',
  'スマホに支配されていません。',
  'もう仙人です。',
]

export function getResultComments(tier: 'low' | 'mid' | 'high'): string[] {
  if (tier === 'low') return RESULT_COMMENTS_LOW
  if (tier === 'mid') return RESULT_COMMENTS_MID
  return RESULT_COMMENTS_HIGH
}

/** 欲張りコメント（最高到達と確定ポイントの差が大きいとき） */
export function greedComment(gap: number): string {
  return `${gap.toLocaleString()}ptぶん欲張りました。`
}

/** ほぼベストタイミングで確定できたときのコメント */
export const NEAR_BEST_COMMENT = 'ほぼベストタイミングで確定できました。'

export function buildShareText(point: number, percent: number, rankName: string): string {
  return `ドパガキ我慢ゲームで${point.toLocaleString()}ptでした。\nランクは「${rankName}」、ドパガキ度${percent}％。\nあなたはこれ超えられる？`
}
