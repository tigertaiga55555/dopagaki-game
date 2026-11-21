import type { PassTitleDef } from '../config/passTitles'

interface Props {
  title: PassTitleDef
  onClose: () => void
}

/**
 * 次フェーズ（DOPA PASS基盤ラウンド）: PASS限定Titleタップ時の詳細モーダル。
 * components/TitleDetailModal.tsx（通常Title、Achievement解除条件を表示）とは別物
 * ——PASS限定Titleに「解除条件」という概念は無く、常に「永久保持」であることだけを示す
 * （68/68 Achievement完了率には一切カウントしない、という設計を文言でも明示する）。
 */
export function PassTitleDetailModal({ title, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="anim-pop w-full max-w-xs rounded-3xl border border-amber-400/40 bg-[#1a0e2e] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mx-auto mb-2 inline-block rounded-full border border-amber-400/60 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-amber-300">
          PASS限定
        </p>
        <h2 className="mb-1 text-lg font-black text-amber-200">{title.name}</h2>
        <p className="mb-4 text-xs leading-relaxed text-white/50">{title.description}</p>
        <p className="mb-5 text-xs font-black text-amber-300">永久保持（68/68 実績完了率にはカウントされません）</p>

        <button onClick={onClose} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-black text-white active:scale-95">
          閉じる
        </button>
      </div>
    </div>
  )
}
