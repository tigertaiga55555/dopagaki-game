interface Props {
  nickname: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 次フェーズ（ゲーム機能クローズラウンド、item 80）: フレンド削除の確認モーダル。
 * ユーザー指定の文言・キャンセル/削除の2択（ConfirmCloseModalと同じ並び順）どおり。
 * 削除自体は取り消し可能（再度フレンド申請すれば元に戻せる）だが、誤タップを避けるため
 * 確認を挟む——呼び出し元（FriendsHomeScreen.tsx/FriendProfileScreen.tsx）側で、
 * このモーダルを開くボタン自体を控えめ・非目立つ配置にする。
 */
export function ConfirmRemoveFriendModal({ nickname, busy, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-6" onClick={onCancel}>
      <div className="anim-pop w-full max-w-xs rounded-3xl border border-rose-400/30 bg-[#1a0e2e] p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm font-black text-white">{nickname}をフレンドから削除しますか？</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white active:scale-95">
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-500/90 py-2.5 text-sm font-black text-white active:scale-95 disabled:opacity-60"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  )
}
