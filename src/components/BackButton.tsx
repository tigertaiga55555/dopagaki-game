interface Props {
  onBack: () => void
  label?: string
}

/**
 * Ver.6 Phase 5（Profile/Achievement/Ranking基盤）: メニュー系画面（Profile/Achievement/
 * Ranking等）専用の「← 戻る」。既存のQuitButton（components/QuitButton.tsx）と同じ
 * safe-area対応の帯方式（fixedは使わず、画面の一番上に普通の子要素として置くだけで
 * 後続コンテンツを押し出す）をそのまま踏襲するが、意図的に別コンポーネントにしてある。
 *
 * QuitButtonは「プレイ中のゲームを即座にやめる」という、3回の実機QA修正を経た
 * センシティブな既存コンポーネントのため、意味の異なる「メニュー間の戻る」操作を
 * 混在させて変更するリスクを避けるためだけに複製した（配置ロジック自体は同一）。
 * 右上のQuitButtonとは逆の左上に置くことで、ゲーム中の「やめる」とメニューの「戻る」が
 * 視覚的にも混同されないようにしている。
 */
export function BackButton({ onBack, label = '戻る' }: Props) {
  return (
    <div
      className="relative z-[70] flex w-full justify-start px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 18px)',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
      }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold leading-none text-white/75 active:scale-90"
        aria-label={`${label}へ戻る`}
      >
        <span aria-hidden="true">←</span>
        <span>{label}</span>
      </button>
    </div>
  )
}
