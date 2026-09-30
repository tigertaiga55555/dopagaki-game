interface Props {
  onQuit: () => void
}

/**
 * Ver.6準備: プレイ中いつでも即座にホームへ戻れる「やめる」ボタン。確認ダイアログや
 * 一時停止を挟まず、押した瞬間にonQuitを呼ぶだけ（結果生成・保存は呼び出し側で一切行わない）。
 * 誤タップを避けるため、回答UIから十分離れた画面右上の隅に小さく配置し、全オーバーレイより
 * 手前（z-[70]）に固定表示することで、どのプレイフェーズ・演出中でも必ず押せるようにする。
 */
export function QuitButton({ onQuit }: Props) {
  return (
    <button
      onClick={onQuit}
      className="fixed right-3 top-3 z-[70] rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white/60 backdrop-blur-sm active:scale-90"
      aria-label="ゲームをやめてホームへ戻る"
    >
      ✕ やめる
    </button>
  )
}
