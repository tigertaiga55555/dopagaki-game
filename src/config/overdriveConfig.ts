/**
 * DOPA OVERDRIVE（100%突破）の設定。
 *
 * Ver.4.9までは、ここにあった隠しeligibility条件（高精度＋高反応＋その他2/3）を
 * 満たさない限りOVERDRIVEへ突入できず、rawScoreが100に到達していても
 * 「100%止まりでOVERDRIVEに入れない・+10秒も付与されない」という実機報告のある
 * 不具合につながっていた。Ver.4.9追加修正でこの隠し条件をOVERDRIVE突入条件としては
 * 廃止し、「rawScoreがゲーム中初めて100%へ到達した瞬間、無条件でOVERDRIVEへ突入する」
 * 仕様に変更した（判定はuseRushGame.tsのsetPercentTarget()内で完結する）。
 *
 * 旧来の高精度・高反応などの概念は、120%（完全ノーミス限定のCLEAR）の判定には使わない
 * （120%はhasEverMissedRefのみで判定する）ため、このファイルにはOVERDRIVEの上限値だけが残る。
 */
export const OVERDRIVE_CONFIG = {
  /** 100%を突破できる最大値。120%は「ゲーム開始から完全ノーミス」の場合のみ到達可能。 */
  maxPercent: 120,
}
