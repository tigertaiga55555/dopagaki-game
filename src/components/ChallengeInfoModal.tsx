interface Props {
  onClose: () => void
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 100）: 「挑戦状を送る」ボタンの「？」から
 * 開く簡易説明モーダル。ResultScreen.tsx（DOPA RUSH）・EndlessResultScreen.tsx（ENDLESS）の
 * 両方から同じコンポーネントを使う（説明文言を2重実装しない）。閉じるボタンのみ、
 * 長文にしない。
 */
export function ChallengeInfoModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-white/10 bg-[#1a0e2e] p-5 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-2 text-base font-black text-amber-200">挑戦状とは？</h2>
        <p className="mb-5 text-xs leading-relaxed text-white/60">
          今回の記録を、他の人に挑戦してもらえる機能です。送られた相手は同じ条件でプレイし、あなたの記録超えを目指します。
        </p>
        <button onClick={onClose} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-black text-white active:scale-95">
          閉じる
        </button>
      </div>
    </div>
  )
}
