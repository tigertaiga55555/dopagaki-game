interface Props {
  onQuit: () => void
}

/**
 * Ver.6準備: プレイ中いつでも即座にホームへ戻れる「×」ボタン。確認ダイアログや
 * 一時停止を挟まず、押した瞬間にonQuitを呼ぶだけ（結果生成・保存は呼び出し側で一切行わない）。
 *
 * 配置修正: 当初「✕ やめる」の横長ピルをTIME/TRIAL表示と同じ右上コーナーへfixed配置していたが、
 * 実機（iPhone）でタイマー・スコア表示に重なることが判明した。同じ角に浮かせる限り、
 * TIME/TRIALのテキスト幅がどうであれ水平方向で衝突し得るため、位置調整ではなく
 * 「別の帯（縦方向に完全に分離した領域）」を使う方式に変更する。
 * このボタン自体は極小の円形「×」のみにし、PlayScreen/FinalTrialScreenの既存ヘッダーより
 * 上の専用の帯（両画面のヘッダーのpadding-topを広げて確保）に置くことで、TIME/スコア/
 * 問題UIのどれとも幾何学的に重ならないことを構造的に保証する。iPhoneのノッチ／
 * Dynamic Island対策として、index.htmlのviewport-fit=coverに合わせsafe-area-inset-*も
 * 加味した位置にする。
 */
export function QuitButton({ onQuit }: Props) {
  return (
    <button
      onClick={onQuit}
      style={{
        top: 'max(0.4rem, env(safe-area-inset-top))',
        right: 'max(0.6rem, env(safe-area-inset-right))',
      }}
      className="fixed z-[70] flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-base font-bold leading-none text-white/70 backdrop-blur-sm active:scale-90"
      aria-label="ゲームをやめてホームへ戻る"
    >
      ×
    </button>
  )
}
