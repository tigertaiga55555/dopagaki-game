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

/**
 * Ver.5.0追加: SNSでの拡散・検索・投稿蓄積のため、全ての共有文に固定で1個だけ付与する
 * ハッシュタグ。「#ゲーム」「#暇つぶし」等を勝手に増やさない（ユーザー指定通り1個のみ）。
 */
export const SHARE_HASHTAG = '#ドパガキゲーム'

/**
 * Ver.5.0: FINAL DOPA TRIALへ突入した場合（finalTrialが存在する場合）は、
 * 「ドパガキ度165% / FINAL DOPA TRIAL 9/16」のように進捗も一緒にシェアできるようにする。
 * 200%（cleared200）の場合だけ、PERFECT CLEARと16/16を明示する。
 * 末尾には必ずSHARE_HASHTAGを1個だけ含める（この関数がshare.ts側の全経路
 * ―画像付き共有／テキストのみ共有／クリップボードコピー／フォールバック―の
 * 唯一の生成元のため、ここで1箇所に集約すれば経路によって消えることがない）。
 */
export function buildShareText(percent: number, typeName: string, finalTrial?: { trialsCleared: number; cleared200: boolean }): string {
  if (finalTrial) {
    if (finalTrial.cleared200) {
      return `ドパガキ度 ${percent}％\nPERFECT CLEAR\n${typeName}\nFINAL DOPA TRIAL ${finalTrial.trialsCleared}/16\n\n100％が上限だと思ってた？\n\n${SHARE_HASHTAG}`
    }
    return `ドパガキ度 ${percent}％\n${typeName}\nFINAL DOPA TRIAL ${finalTrial.trialsCleared}/16\n\n100％が上限だと思ってた？\n\n${SHARE_HASHTAG}`
  }
  if (percent > 100) {
    return `ドパガキ度 ${percent}％\n${typeName}\n\n100％が上限だと思ってた？\n\n${SHARE_HASHTAG}`
  }
  return `ドパガキ度 ${percent}％\n${typeName}\n\n100％いける？\n\n${SHARE_HASHTAG}`
}

/**
 * Ver.5.0追加修正: 共有URLは常にこの本番URL固定（index.htmlのog:urlと同一ドメイン）。
 * window.location.hrefを使わないのは、?preview=... のPreview専用URLがそのまま
 * 共有されてしまう事故を構造的に防ぐため（get_share_url()はこれを常に返すだけにする）。
 *
 * Ver.5.0追加修正: LINE等のリンクプレビューが、現行のゲーム内容とは無関係な旧タイトルの
 * OGP文言をキャッシュしたまま表示する不具合が報告された。og:image/twitter:imageの
 * ファイル名にバージョンを付けた（og-image.png→og-image-v5.png）のに加え、ここでも
 * 共有URL自体に`?v=5`を付与し、アプリから新たに共有されるリンクは必ず「LINE等の
 * クローラーがまだ見たことのない新しいURL」になるようにした（これにより、既に
 * キャッシュされてしまった無印URLの古いプレビューに引きずられず、新しい共有分は
 * 確実に新しいOGPで再取得される）。`?v=5`はApp.tsx側で読み取られることのない
 * 未使用のquery paramのため、ゲーム本体の起動・挙動には一切影響しない
 * （既存の?preview=...判定もURLSearchParamsで該当キーだけを見ており、他のquery
 * paramの有無に影響されない）。
 */
export const V4_SHARE_URL = 'https://dopagaki-game.vercel.app/?v=5'
