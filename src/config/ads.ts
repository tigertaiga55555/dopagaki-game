/**
 * Ver.6 Phase 9（実機QA反映: 広告の一時非表示)： 広告システム自体（AdSlot・ここの広告タグ/ID）は
 * 後日ゼロから再設計する（バナー/インタースティシャル/リワード/DOPA PASSで非表示、等）ため、
 * コードは一切削除せず残す。現行Ver.6 Previewの各画面には今は描画したくないだけなので、
 * この1フラグをfalseにすることで既存の全箇所（TitleScreen/ResultScreen）を一括で非表示にする。
 * Ver.5本番（main/Production）はこのブランチの変更を一切受け取らないため、この変更は
 * Ver.6 Preview限定であり、本番の広告表示には何の影響もない。
 * 再設計後に広告を復活させる時は、このフラグをtrueに戻すだけでよい。
 */
export const ADS_ENABLED_V6 = false

export const AD_START_SCREEN = {
  slotName: 'ドパガキ_スタート_320x100',
  width: 320,
  height: 100,
  tag: '<!-- admax -->\n<script src="https://adm.shinobi.jp/s/940610503db258a80154a2daac7a4783"></script>\n<!-- admax -->',
} as const

export const AD_RESULT_SCREEN = {
  slotName: 'ドパガキ_結果_300x250',
  width: 300,
  height: 250,
  tag: '<!-- admax -->\n<script src="https://adm.shinobi.jp/s/283af580a4b2ce82cfafca93c86239f5"></script>\n<!-- admax -->',
} as const
