import { useState } from 'react'

interface Props {
  onSet: (count: number) => void
}

const QUICK_VALUES = [0, 1, 5] as const

/**
 * 次フェーズ（DOPA HEART本実装）QA補助: Heart所持数を0/1/5へ即時セットできるパネル。
 * dev/Challenge500QaPanel.tsxと同じ方針（Previewでしか呼び出し元が描画しない、
 * コンポーネント自体はバンドルに含まれても本番では画面に出ない）。
 */
export function HeartQaPanel({ onSet }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-3 right-3 z-[80] flex flex-col items-end gap-2">
      {open && (
        <div className="anim-pop w-48 rounded-xl border border-rose-400/40 bg-black/90 p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-black tracking-widest text-rose-300">QA: Heartを即セット</p>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_VALUES.map((v) => (
              <button
                key={v}
                onClick={() => onSet(v)}
                className="rounded-lg bg-white/10 py-1.5 text-[11px] font-black text-white active:scale-90"
              >
                ❤️{v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] font-bold leading-tight text-white/40">Preview専用。本番には一切表示されません。</p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-rose-600/90 px-3 py-1.5 text-[11px] font-black text-white shadow-lg active:scale-90"
      >
        {open ? 'QA ×' : '🔧 Heart'}
      </button>
    </div>
  )
}
