interface Props {
  onQuit: () => void
}

/**
 * Ver.6準備: プレイ中いつでも即座にホームへ戻れる「× やめる」。確認ダイアログや
 * 一時停止を挟まず、押した瞬間にonQuitを呼ぶだけ（結果生成・保存は呼び出し側で一切行わない）。
 *
 * 配置修正の経緯（2回目）: 「別の帯を確保する」対応として、いったんはこのボタン自体を
 * fixedで右上に置きつつ、PlayScreen/FinalTrialScreenのヘッダー側のpadding-topを広げて
 * 隙間を作る方式にしていた。しかしSafariでは重ならなかったものの、Xアプリ内ブラウザの
 * WebViewでは実機でTIME表示に重なることが確認された。fixed＋safe-area-inset-*の実際の
 * 解釈がブラウザ／WebViewごとに微妙に異なるため、「fixedな絶対座標の勘」に頼る限り
 * 特定環境での衝突を構造的には排除できない。
 *
 * そのため、このコンポーネント自体を「やめる」専用の帯（通常のドキュメントフローに
 * 参加する普通のブロック要素）として作り直した。fixedは使わず、呼び出し側
 * （PlayScreen/FinalTrialScreen）の一番上に普通の子要素として置くだけでよい。
 * この帯が実際にどれだけの高さを占めるかは、どのブラウザでも同じレイアウトエンジンの
 * ボックスモデルで決まるため、続く既存HUD（DOPAGAKI%/TIME/TRIAL等）は必ずこの帯の
 * 実高さぶんだけ下に押し出される。「fixedで上から被せる」のではなく「専用の段を
 * 確保してから、その下に並べて表示する」構造にすることで、safe-areaの解釈差や
 * WebViewごとのビューポート計算の違いに関わらず、幾何学的に重なりようがなくなる。
 *
 * 高さは以前の小さな丸ボタンとほぼ同じ（見た目のインパクトを抑えたまま「やめる」の
 * 文字を追加できるよう、円形ではなく横に短いピル型にした）。
 */
export function QuitButton({ onQuit }: Props) {
  return (
    <div
      className="relative z-[70] flex w-full justify-end px-4"
      style={{
        paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <button
        onClick={onQuit}
        className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold leading-none text-white/60 active:scale-90"
        aria-label="ゲームをやめてホームへ戻る"
      >
        <span aria-hidden="true">×</span>
        <span>やめる</span>
      </button>
    </div>
  )
}
