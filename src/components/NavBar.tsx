interface Props {
  /** 「← 戻る」。常にスタックを1つだけpopする——画面ごとに意味の違うバックボタンは作らない。 */
  onBack: () => void
  /**
   * 「⌂ ホーム」。スタックを全部クリアしてHomeへ直接ジャンプする。省略した画面には
   * 表示しない（例: 待機中のマッチング画面のような、深い階層にはまだ達していない画面）。
   */
  onHome?: () => void
}

/**
 * 次フェーズ（FRIENDS/ナビ刷新ラウンド、item 32-34）: メニュー系画面共通のナビゲーション帯。
 *
 * ユーザー指示の固定ルール:
 * - 「← 戻る」は常にこの文言・常に「1つ戻る」という意味だけを持つ（旧BackButtonの
 *   `label`props・画面ごとの「← プロフィール」等のカスタムラベルは廃止——
 *   utils/subScreenNavigation.tsの「開いた場所を記憶して戻り先を変える」仕組みは、
 *   App.tsx側の本物のナビゲーションスタック導入によって不要になった）。
 * - 「⌂ ホーム」は別ボタン。スタック全クリア＋Homeへ直接ジャンプ（ブラウザの
 *   history.back()には一切依存しない、既存のscreen状態モデルの延長として実装）。
 * - 配置は固定: 戻るは左上・ホームは右上（隣接させない）、safe-area対応。
 * - プレイ中の画面（既存の×やめるパターン）・モーダルには出さない——呼び出し側
 *   （App.tsx各画面の分岐）がこのコンポーネント自体を使わないことで保証する。
 */
export function NavBar({ onBack, onHome }: Props) {
  return (
    <div
      className="relative z-[70] flex w-full items-start justify-between px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 18px)',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold leading-none text-white/75 active:scale-90"
        aria-label="戻る"
      >
        <span aria-hidden="true">←</span>
        <span>戻る</span>
      </button>
      {onHome && (
        <button
          onClick={onHome}
          className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold leading-none text-white/75 active:scale-90"
          aria-label="ホームへ戻る"
        >
          <span aria-hidden="true">⌂</span>
          <span>ホーム</span>
        </button>
      )}
    </div>
  )
}
